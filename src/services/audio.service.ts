// src/services/audio.service.ts

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioLevel = new Subject<number>();
  private audioData = new Subject<AudioChunk>();

  public audioLevel$ = this.audioLevel.asObservable();
  public audioData$ = this.audioData.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  async startRecording(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Required by Gemini API
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // Match Gemini API requirements
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.setupAudioProcessing(stream);

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          this.audioData.next({
            data: buffer,
            timestamp: Date.now()
          });
        }
      };

      this.mediaRecorder.start(100); // Capture data every 100ms
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  private setupAudioProcessing(stream: MediaStream) {
    if (!this.audioContext) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const checkAudioLevel = () => {
      if (this.mediaRecorder?.state === 'recording') {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        this.audioLevel.next(average);
        requestAnimationFrame(checkAudioLevel);
      }
    };

    checkAudioLevel();
  }

  stopRecording(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      const tracks = this.mediaRecorder.stream.getTracks();
      tracks.forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  dispose(): void {
    this.stopRecording();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioLevel.complete();
    this.audioData.complete();
  }
}