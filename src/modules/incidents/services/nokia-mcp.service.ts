import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CamaraService } from '../../camara/camara.service.js';

const NOKIA_MCP_API_HOST = 'network-as-code.nokia.rapidapi.com';

const VIRTUAL_TOOLS: OpenAI.Chat.ChatCompletionFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_sim_swap',
      description:
        'Check if the SIM card associated with a phone number has been swapped recently.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format, e.g. +99999991001',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_device_swap',
      description:
        'Check if the device (IMEI) associated with a phone number has been swapped recently.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_location',
      description:
        'Verify whether a device is within a specified geographic area.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
          latitude: {
            type: 'number',
            description: 'Latitude of the center point',
          },
          longitude: {
            type: 'number',
            description: 'Longitude of the center point',
          },
          radius_meters: { type: 'number', description: 'Radius in meters' },
        },
        required: ['phone_number', 'latitude', 'longitude', 'radius_meters'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_roaming',
      description:
        'Check if a device is currently roaming on a foreign network.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_number',
      description:
        'Silently verify a phone number via network-based authentication.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_congestion',
      description:
        'Query historical and predicted network congestion levels for a device.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
          window_minutes: {
            type: 'number',
            description: 'Time window in minutes to look back (default: 5)',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_call_forwarding',
      description:
        'Check if unconditional call forwarding is active on a phone number. Active forwarding during a USSD emergency trigger is a SIM hijacking signal.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format',
          },
        },
        required: ['phone_number'],
        additionalProperties: false,
      },
    },
  },
];

function toOpenAiTool(mcpTool: Tool): OpenAI.Chat.ChatCompletionFunctionTool {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description ?? '',
      parameters: {
        type: 'object',
        properties:
          (mcpTool.inputSchema as { properties?: Record<string, unknown> })
            .properties ?? {},
        required:
          (mcpTool.inputSchema as { required?: string[] }).required ?? [],
        additionalProperties: false,
      },
    },
  };
}

@Injectable()
export class NokiaMcpService implements OnModuleInit, OnModuleDestroy {
  private mcpClient: Client | null = null;
  private openAiTools: OpenAI.Chat.ChatCompletionFunctionTool[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly camaraService: CamaraService,
    @InjectPinoLogger(NokiaMcpService.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const mcpServerUrl = this.configService.get<string>('nokia.mcpServerUrl');
    const nokiaApiKey = this.configService.get<string>('nokia.apiKey');

    if (mcpServerUrl && nokiaApiKey) {
      try {
        const transport = new StreamableHTTPClientTransport(
          new URL(mcpServerUrl),
          {
            requestInit: {
              headers: {
                'x-api-key': nokiaApiKey,
                'x-api-host': NOKIA_MCP_API_HOST,
              },
            },
          },
        );

        this.mcpClient = new Client({ name: 'bicon', version: '1.0.0' });
        await this.mcpClient.connect(transport);

        const { tools } = await this.mcpClient.listTools();
        this.openAiTools = tools.map(toOpenAiTool);

        this.logger.info(
          { toolCount: tools.length, tools: tools.map((t) => t.name) },
          'NokiaMcpService: connected to Nokia MCP server',
        );
      } catch (err) {
        this.logger.error(
          { err },
          'NokiaMcpService: MCP connection failed — falling back to SDK virtual tools',
        );
        this.mcpClient = null;
        this.openAiTools = VIRTUAL_TOOLS;
      }
    } else {
      this.openAiTools = VIRTUAL_TOOLS;
      this.logger.info(
        {
          reason: mcpServerUrl ? 'no NOKIA_API_KEY' : 'no NOKIA_MCP_SERVER_URL',
        },
        'NokiaMcpService: running in SDK virtual-tool mode',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mcpClient) {
      try {
        await this.mcpClient.close();
      } catch {
        // best-effort
      }
    }
  }

  getTools(): OpenAI.Chat.ChatCompletionFunctionTool[] {
    return this.openAiTools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.mcpClient) {
      const result = await this.mcpClient.callTool({ name, arguments: args });
      return result.content;
    }
    return this.dispatchVirtualTool(name, args);
  }

  private async dispatchVirtualTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const phone = (args['phone_number'] as string | undefined) ?? '';

    switch (name) {
      case 'check_sim_swap':
        return this.camaraService.checkSimSwap(phone);

      case 'check_device_swap':
        return this.camaraService.checkDeviceSwap(phone);

      case 'verify_location':
        return this.camaraService.verifyLocation(
          phone,
          args['latitude'] as number,
          args['longitude'] as number,
          args['radius_meters'] as number,
        );

      case 'check_roaming':
        return this.camaraService.checkRoaming(phone);

      case 'verify_number':
        return null;

      case 'get_congestion':
        return this.camaraService.getCongestion(
          phone,
          (args['window_minutes'] as number | undefined) ?? 5,
        );

      case 'check_call_forwarding':
        return this.camaraService.checkCallForwarding(phone);

      default:
        this.logger.warn({ name }, 'NokiaMcpService: unknown virtual tool');
        return null;
    }
  }
}
