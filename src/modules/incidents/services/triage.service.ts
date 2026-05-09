import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import OpenAI from 'openai';
import type {
  IncidentDocument,
  TriageResult,
} from '../schemas/incident.schema.js';

const SYSTEM_PROMPT = `You are an emergency dispatch AI assistant for Sub-Saharan Africa.
Analyze the incident data provided and respond ONLY with a valid JSON object.
No preamble, no markdown code fences, no explanation — raw JSON only.

Required fields:
- severity: "LOW" | "HIGH" | "CRITICAL"
- incidentType: one of ROAD_ACCIDENT | FIRE | FLOOD | CROWD_CRUSH | MEDICAL | DOMESTIC | UNKNOWN
- escalationRisk: integer 0-100
- summary: string, max 2 sentences describing what happened and why it matters
- recommendedAction: string, one specific actionable instruction for the dispatcher
- confidenceNote: string, what additional data would change this assessment`;

function buildUserPrompt(incident: IncidentDocument): string {
  const breakdown = incident.vesBreakdown
    ? Object.entries(incident.vesBreakdown as Record<string, number>)
        .map(([k, v]) => `  ${k}: ${v > 0 ? '+' : ''}${v}`)
        .join('\n')
    : '  none';

  const lines = [
    `Incident ID: ${(incident._id as { toString(): string }).toString()}`,
    `Timestamp: ${incident.createdAt.toISOString()}`,
    `Signal Source: ${incident.source}`,
    `Signal Type: ${incident.type}`,
    `Incident Type (initial): ${incident.type}`,
    `VES Score: ${incident.vesScore ?? 'unscored'} / 100`,
    `VES Tier: ${incident.vesTier ?? 'unscored'}`,
    `VES Score Breakdown:\n${breakdown}`,
  ];

  if (incident.phoneNumber)
    lines.push(`Reporter Phone: ${incident.phoneNumber}`);
  if (incident.zoneId) lines.push(`Zone ID: ${incident.zoneId}`);
  if (incident.coordinates) {
    lines.push(
      `Coordinates: ${incident.coordinates.lat}, ${incident.coordinates.lng}`,
    );
  }

  return lines.join('\n');
}

function isValidTriageResult(obj: unknown): obj is TriageResult {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t['severity'] === 'string' &&
    ['LOW', 'HIGH', 'CRITICAL'].includes(t['severity']) &&
    typeof t['incidentType'] === 'string' &&
    typeof t['escalationRisk'] === 'number' &&
    t['escalationRisk'] >= 0 &&
    t['escalationRisk'] <= 100 &&
    typeof t['summary'] === 'string' &&
    typeof t['recommendedAction'] === 'string' &&
    typeof t['confidenceNote'] === 'string'
  );
}

@Injectable()
export class TriageService {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(TriageService.name)
    private readonly logger: PinoLogger,
  ) {
    const apiKey = this.configService.get<string>('openrouter.apiKey')!;
    this.model = this.configService.get<string>('openrouter.model')!;

    if (!apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY not set — TriageService running in stub mode, analyze() returns null',
      );
      this.client = null;
    } else {
      this.client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://bicon.emergency',
          'X-Title': 'Bicon Emergency Platform',
        },
      });
    }
  }

  async analyze(incident: IncidentDocument): Promise<TriageResult | null> {
    if (!this.client) return null;

    const userPrompt = buildUserPrompt(incident);
    const incidentId = (incident._id as { toString(): string }).toString();

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const t = Date.now();
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 512,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        });

        const text = response.choices[0]?.message?.content ?? '';
        const jsonMatch = text.match(/\{[\s\S]+\}/);
        if (!jsonMatch) {
          throw new Error(`No JSON in triage response: ${text.slice(0, 300)}`);
        }
        const parsed: unknown = JSON.parse(jsonMatch[0]);

        if (!isValidTriageResult(parsed)) {
          throw new Error(
            `Invalid triage shape: ${JSON.stringify(parsed).slice(0, 200)}`,
          );
        }

        this.logger.info(
          { incidentId, latencyMs: Date.now() - t, model: this.model },
          'Triage analysis complete',
        );
        return parsed;
      } catch (err) {
        if (attempt === 2) {
          this.logger.error(
            { incidentId, err: (err as Error).message },
            'Triage failed after 2 attempts',
          );
          return null;
        }
        this.logger.warn(
          { incidentId, attempt, err: (err as Error).message },
          'Triage attempt failed, retrying',
        );
      }
    }

    return null;
  }
}
