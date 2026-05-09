import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import {
  AGENTIC_INCIDENT_QUEUE,
  IncidentStatus,
  SignalSource,
  SignalType,
  VesTier,
} from '../../../common/types/constant.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import { BiconGateway } from '../../gateway/bicon.gateway.js';
import { IncidentRepository } from '../repositories/incident.repository.js';
import { NokiaMcpService } from '../services/nokia-mcp.service.js';
import { CamaraService } from '../../camara/camara.service.js';

export interface AgenticJobData {
  incidentId: string;
  phoneNumber?: string;
  signalType: SignalType;
  signalSource: SignalSource;
  coordinates?: { lat: number; lng: number };
  zoneId?: string;
}

interface AgenticAssessment {
  vesScore: number;
  vesTier: string;
  vesBreakdown: Record<string, { delta: number; result: string; reasoning: string }>;
  severity: 'LOW' | 'HIGH' | 'CRITICAL';
  incidentType: string;
  escalationRisk: number;
  summary: string;
  recommendedAction: string;
  confidenceNote: string;
  toolsCalledCount: number;
  agentReasoning: string;
}

const AGENTIC_SYSTEM_PROMPT = `You are Bicon's emergency intelligence agent for Sub-Saharan Africa.
An emergency signal has been detected. Investigate using the Nokia CAMARA network tools available to you.

INVESTIGATION PROCESS:
1. Start with check_sim_swap — the most critical fraud signal
2. Check check_call_forwarding — active forwarding during a USSD trigger is SIM hijacking
3. Check check_roaming for suspicious network context
4. If coordinates available: verify_location to corroborate the signal
5. Check get_congestion to confirm network anomaly
6. Use check_device_swap if other signals are ambiguous
7. After gathering evidence, produce your final JSON assessment

NOTE ON TOOL RESPONSES:
- Location tool returns: verified (boolean), matchRate (integer 1-99, only present for PARTIAL matches)
- SIM/device swap tools return: swapped (boolean)
- Roaming tool returns: roaming (boolean), countryCode, countryName
- Congestion tool returns array of: level, confidence, start, stop
- If Nokia MCP server returns raw API fields: verificationResult="TRUE"/"PARTIAL"/"FALSE", treat accordingly

SCORING:
Start at 50/100.
- SIM swap detected: -30 (major fraud signal)
- Call forwarding active: -20 (SIM hijacking signal — attacker forwarding victim's calls)
- Device swap detected: -15
- Location verified exact (verified=true): +20
- Location partial match (matchRate present): +(matchRate/100 * 20) points
- Location mismatch (verified=false, no matchRate): -25
- Roaming detected: -10 (suspicious context)
- Number verify authentic: +15; failed: -20
- NETWORK_PASSIVE signal source: +10 (passive network corroboration)
- HUMAN signal source (USSD): +5 (direct report)
- Clamp final score to 0-100
- DISMISSED: 0-40, WATCH: 41-65, HIGH: 66-85, CRITICAL: 86-100

FINAL RESPONSE — output ONLY this JSON object, no preamble, no markdown fences:
{
  "vesScore": <0-100>,
  "vesTier": "DISMISSED" | "WATCH" | "HIGH" | "CRITICAL",
  "vesBreakdown": { "<toolName>": { "delta": <number>, "result": "<summary>", "reasoning": "<why>" } },
  "severity": "LOW" | "HIGH" | "CRITICAL",
  "incidentType": "ROAD_ACCIDENT"|"FIRE"|"FLOOD"|"CROWD_CRUSH"|"MEDICAL"|"DOMESTIC"|"UNKNOWN",
  "escalationRisk": <0-100>,
  "summary": "<max 2 sentences for a dispatcher>",
  "recommendedAction": "<one specific instruction>",
  "confidenceNote": "<what would change this assessment>",
  "toolsCalledCount": <number>,
  "agentReasoning": "<2-3 sentences on how you reached this conclusion>"
}`;

function buildUserMessage(data: AgenticJobData): string {
  const lines: (string | null)[] = [
    `Signal Source: ${data.signalSource}`,
    `Signal Type: ${data.signalType}`,
    `Phone Number: ${data.phoneNumber ?? 'not available'}`,
    data.coordinates ? `Coordinates: ${data.coordinates.lat}, ${data.coordinates.lng}` : null,
    data.zoneId ? `Zone ID: ${data.zoneId}` : null,
    `Timestamp: ${new Date().toISOString()}`,
    `\nCall the Nokia network tools to investigate. Start with the most critical signals.`,
  ];
  return lines.filter(Boolean).join('\n');
}

@Processor(AGENTIC_INCIDENT_QUEUE)
@Injectable()
export class AgenticIncidentProcessor extends WorkerHost {
  private readonly openAiClient: OpenAI | null;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly incidentRepository: IncidentRepository,
    private readonly nokiaMcpService: NokiaMcpService,
    private readonly camaraService: CamaraService,
    private readonly gateway: BiconGateway,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(AgenticIncidentProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
    const apiKey = this.configService.get<string>('openrouter.apiKey')!;
    this.model = this.configService.get<string>('openrouter.model')!;

    if (!apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY not set — AgenticIncidentProcessor running in stub mode',
      );
      this.openAiClient = null;
    } else {
      this.openAiClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://bicon.emergency',
          'X-Title': 'Bicon Emergency Platform',
        },
      });
    }
  }

  async process(job: Job<AgenticJobData>): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const { incidentId } = job.data;

        await this.incidentRepository.updateById(incidentId, {
          status: IncidentStatus.SCORING,
        });

        this.gateway.emitToAll('incident:scoring-started', {
          incidentId,
          status: IncidentStatus.SCORING,
        });

        const tools = this.nokiaMcpService.getTools();

        this.gateway.emitToAll('incident:agent-tool-plan', {
          incidentId,
          availableTools: tools.map((t) => t.function.name),
        });

        this.logger.info({ incidentId, toolCount: tools.length }, 'Agentic pipeline started');

        let assessment: AgenticAssessment | null = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            assessment = await this.runAgenticLoop(incidentId, job.data, tools);
            break;
          } catch (err) {
            if (attempt === 2) {
              this.logger.error(
                { incidentId, err },
                'Agentic loop failed after 2 attempts',
              );
              await this.incidentRepository.updateById(incidentId, {
                pipelineVersion: 'v2',
                triageError: (err as Error).message,
                triagedAt: new Date(),
              });
              this.gateway.emitToAll('incident:triage-complete', {
                incidentId,
                triage: null,
                error: true,
              });
              return;
            }
            this.logger.warn(
              { incidentId, attempt, err: (err as Error).message },
              'Agentic loop attempt failed, retrying',
            );
          }
        }

        if (!assessment) return;

        const vesTierEnum = assessment.vesTier as unknown as IncidentStatus;

        await this.incidentRepository.updateById(incidentId, {
          vesScore: assessment.vesScore,
          vesTier: assessment.vesTier as VesTier,
          vesBreakdown: assessment.vesBreakdown,
          scoredAt: new Date(),
          status: vesTierEnum,
          triage: {
            severity: assessment.severity,
            incidentType: assessment.incidentType,
            escalationRisk: assessment.escalationRisk,
            summary: assessment.summary,
            recommendedAction: assessment.recommendedAction,
            confidenceNote: assessment.confidenceNote,
          },
          triagedAt: new Date(),
          pipelineVersion: 'v2',
          agentReasoning: assessment.agentReasoning,
          toolsCalledCount: assessment.toolsCalledCount,
        });

        this.gateway.emitToAll('incident:ves-complete', {
          incidentId,
          score: assessment.vesScore,
          tier: assessment.vesTier,
          breakdown: assessment.vesBreakdown,
          status: assessment.vesTier,
        });

        this.gateway.emitToAll('incident:triage-complete', {
          incidentId,
          triage: {
            severity: assessment.severity,
            incidentType: assessment.incidentType,
            escalationRisk: assessment.escalationRisk,
            summary: assessment.summary,
            recommendedAction: assessment.recommendedAction,
            confidenceNote: assessment.confidenceNote,
          },
          tier: assessment.vesTier,
          score: assessment.vesScore,
        });

        this.gateway.emitToAll('incident:agent-reasoning', {
          incidentId,
          reasoning: assessment.agentReasoning,
          toolsCalledCount: assessment.toolsCalledCount,
        });

        this.logger.info(
          { incidentId, vesScore: assessment.vesScore, vesTier: assessment.vesTier },
          'Agentic pipeline complete',
        );

        if (assessment.vesTier === VesTier.CRITICAL && job.data.phoneNumber) {
          try {
            await this.camaraService.createQodSession(job.data.phoneNumber, 'QOS_E', 3600);
          } catch {
            // best-effort QoD boost
          }
        }
      },
    );
  }

  private async runAgenticLoop(
    incidentId: string,
    data: AgenticJobData,
    tools: OpenAI.Chat.ChatCompletionFunctionTool[],
  ): Promise<AgenticAssessment> {
    if (!this.openAiClient) {
      return this.stubAssessment(data);
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: AGENTIC_SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(data) },
    ];

    const MAX_ITERATIONS = 15;
    let toolsCalledCount = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.openAiClient.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        tools,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls,
        });

        const fnCalls = choice.message.tool_calls.filter(
          (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function',
        );

        for (const toolCall of fnCalls) {
          const t = Date.now();
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const result = await this.nokiaMcpService.callTool(toolCall.function.name, args);
          const latencyMs = Date.now() - t;
          toolsCalledCount++;

          this.gateway.emitToAll('incident:api-call', {
            incidentId,
            apiName: toolCall.function.name,
            result,
            latencyMs,
            success: result !== null,
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result ?? null),
          });
        }
      } else if (choice.finish_reason === 'stop') {
        const text = choice.message.content ?? '';
        const jsonMatch = text.match(/\{[\s\S]+\}/);
        if (!jsonMatch) {
          throw new Error(`No JSON in Claude response: ${text.slice(0, 300)}`);
        }
        const parsed = JSON.parse(jsonMatch[0]) as AgenticAssessment;
        parsed.toolsCalledCount = toolsCalledCount;
        return parsed;
      } else {
        throw new Error(`Unexpected finish_reason: ${choice.finish_reason}`);
      }
    }

    throw new Error(`Agentic loop hit safety limit of ${MAX_ITERATIONS} iterations`);
  }

  private stubAssessment(data: AgenticJobData): AgenticAssessment {
    return {
      vesScore: 50,
      vesTier: VesTier.WATCH,
      vesBreakdown: {},
      severity: 'HIGH',
      incidentType: 'UNKNOWN',
      escalationRisk: 50,
      summary: 'Stub assessment — OPENROUTER_API_KEY not configured.',
      recommendedAction: 'Configure OPENROUTER_API_KEY to enable agentic triage.',
      confidenceNote: 'No AI analysis performed.',
      toolsCalledCount: 0,
      agentReasoning: `Stub mode active for signal from ${data.signalSource}.`,
    };
  }
}
