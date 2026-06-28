'use strict';

class NotebookSocketHub {
  constructor() {
    this.clients = new Set();
  }

  handle(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.write('\n');
    const client = { res };
    this.clients.add(client);
    this.emit('bridge:status', { connectedClients: this.clients.size });
    req.on('close', () => {
      this.clients.delete(client);
    });
  }

  emit(event, payload = {}) {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(body);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  stats() {
    return { clients: this.clients.size };
  }
}

module.exports = {
  NotebookSocketHub,
};
