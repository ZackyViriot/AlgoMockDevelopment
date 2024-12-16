// services/audio.service.ts

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  
  public audioStream$ = new Subject<Blob>();
  public isRecording$ = new BehaviorSubject<boolean>(false);
  public audioLevel$ = new Subject<number>();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initAudioContext();
    }
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Audio Context initialization failed:', error);
    }
  }

  async startRecording(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      this.setupAudioAnalyzer(stream);
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioStream$.next(audioBlob);
        this.audioChunks = [];
        this.isRecording$.next(false);
      };

      this.mediaRecorder.onstart = () => {
        this.isRecording$.next(true);
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event);
        this.isRecording$.next(false);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startAudioLevelMonitoring();

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  private setupAudioAnalyzer(stream: MediaStream) {
    if (!this.audioContext) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 2048;
    source.connect(this.analyzer);
  }

  private startAudioLevelMonitoring() {
    if (!this.analyzer) return;

    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!this.isRecording$.value) return;

      this.analyzer!.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      this.audioLevel$.next(average);

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  stopRecording(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  async playAudio(audioBlob: Blob): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    try {
      await audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      URL.revokeObjectURL(audioUrl);
      throw error;
    }
  }

  async audioToBase64(blob: Blob): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Audio conversion not available in SSR');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject('Failed to convert audio to base64');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}