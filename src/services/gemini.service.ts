// src/services/gemini.service.ts

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { WebSocketService } from './websocket.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private audioContext: AudioContext | null = null;
  private isStreaming = false;

  constructor(
    private wsService: WebSocketService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private initAudioContext() {
    if (isPlatformBrowser(this.platformId) && !this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  startAudioStream(): Observable<ArrayBuffer> {
    this.initAudioContext(); // Initialize when starting stream
    this.isStreaming = true;
    return this.wsService.connect();
  }

  async sendAudioChunk(audioData: ArrayBuffer) {
    if (!this.isStreaming) return;
    try {
      const processedData = await this.processAudioData(audioData);
      this.wsService.sendAudioChunk(processedData);
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async processAudioData(audioData: ArrayBuffer): Promise<ArrayBuffer> {
    return audioData;
  }

  async playAudioResponse(audioData: ArrayBuffer) {
    if (!this.audioContext) {
      this.initAudioContext();
    }

    try {
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData);
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext!.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing audio response:', error);
    }
  }

  stopAudioStream() {
    this.isStreaming = false;
    this.wsService.close();
  }
}