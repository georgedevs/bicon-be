import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class BiconGateway {
  @WebSocketServer()
  private readonly server!: Server;

  emitToAll(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }
}
