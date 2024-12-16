import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private audioStream$ = new Subject<ArrayBuffer>();
  private isConnected = false;
  private url: string;
  private setupComplete = false;

  constructor() {
    this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${environment.API_KEY}`;
  }

  private initializeWebSocket() {
    if (!this.socket) {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.sendSetupMessage();
        };

        this.socket.onmessage = (event: MessageEvent) => {
          try {
            if (event.data instanceof Blob) {
              event.data.arrayBuffer().then(buffer => {
                this.audioStream$.next(buffer);
              });
            } else {
              const parsedData = JSON.parse(event.data);
              console.log('Received message:', parsedData);
              
              if (!this.setupComplete && parsedData.type === 'BidiGenerateContentSetupComplete') {
                console.log('Setup completed successfully');
                this.setupComplete = true;
              }
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
        };

        this.socket.onclose = (event) => {
          console.log('WebSocket connection closed', event.code, event.reason);
          this.isConnected = false;
          this.setupComplete = false;
        };
      } catch (error) {
        console.error('Error initializing WebSocket:', error);
      }
    }
  }

  private sendSetupMessage() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const setupMessage = {
        generation_config: {
          temperature: 0.9,
          top_k: 40,
          top_p: 0.95,
          max_output_tokens: 1024,
          response_modalities: ["TEXT", "AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: "Puck"
              }
            }
          }
        }
      };
      console.log('Sending setup message:', setupMessage);
      this.socket.send(JSON.stringify(setupMessage));
    }
  }

  sendMessage(text: string) {
    if (!this.setupComplete) {
      console.error('Cannot send message: Setup not complete');
      return;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = {
        client_content: {
          turns: [
            {
              parts: [{ text }],
              role: "user"
            }
          ],
          turn_complete: true
        }
      };
      this.socket.send(JSON.stringify(message));
    }
  }

  sendAudioChunk(audioData: ArrayBuffer) {
    if (!this.setupComplete) {
      console.error('Cannot send audio: Setup not complete');
      return;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = {
        realtime_input: {
          media_chunks: [audioData]
        }
      };
      this.socket.send(JSON.stringify(message));
    }
  }

  connect(): Observable<ArrayBuffer> {
    if (!this.isConnected) {
      this.initializeWebSocket();
    }
    return this.audioStream$.asObservable();
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.setupComplete = false;
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.setupComplete && this.socket?.readyState === WebSocket.OPEN;
  }
}