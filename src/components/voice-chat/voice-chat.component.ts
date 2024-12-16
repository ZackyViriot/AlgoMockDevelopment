// src/components/voice-chat/voice-chat.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../services/audio.service';
import { SpeechService } from '../../services/speech.service';
import { GeminiService } from '../../services/gemini.service';
import { Subject, takeUntil } from 'rxjs';

interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
}

@Component({
  selector: 'app-voice-chat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="voice-chat-container">
      <div class="status-bar">
        <div class="status" [class.active]="isListening">
          <span *ngIf="isListening && !isSpeaking">Listening...</span>
          <span *ngIf="isSpeaking">AI Speaking...</span>
          <span *ngIf="!isListening && !isSpeaking">Click Start to begin conversation</span>
        </div>
        <div class="audio-level" *ngIf="isListening">
          <div class="level-bar" [style.height.%]="audioLevel"></div>
        </div>
      </div>

      <div class="controls">
        <button (click)="toggleConversation()" 
                [class.active]="isListening"
                [disabled]="isProcessing">
          {{ isListening ? 'Stop' : 'Start' }}
        </button>
      </div>
    </div>
  `,
  styles: [/* ... styles remain the same ... */]
})
export class VoiceChatComponent implements OnInit, OnDestroy {
  isListening = false;
  isProcessing = false;
  isSpeaking = false;
  audioLevel = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private audioService: AudioService,
    private speechService: SpeechService,
    private geminiService: GeminiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    // Audio level monitoring
    this.audioService.audioLevel$
      .pipe(takeUntil(this.destroy$))
      .subscribe(level => {
        this.audioLevel = level;
        this.cdr.detectChanges();
      });

    // Speaking state
    this.speechService.isSpeaking$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSpeaking => {
        this.isSpeaking = isSpeaking;
        if (!isSpeaking && this.isListening) {
          this.startListening();
        }
        this.cdr.detectChanges();
      });
  }

  async toggleConversation() {
    if (this.isListening) {
      this.stopConversation();
    } else {
      await this.startConversation();
    }
  }

  private async startConversation() {
    try {
      this.isListening = true;
      await this.audioService.startRecording();
      
      // Start the audio stream with Gemini
      const audioStream = this.geminiService.startAudioStream();
      
      // Subscribe to the audio stream response
      audioStream.pipe(takeUntil(this.destroy$)).subscribe({
        next: async (audioData: ArrayBuffer) => {
          // Play the received audio response
          await this.geminiService.playAudioResponse(audioData);
        },
        error: (error) => {
          console.error('Error in audio stream:', error);
          this.isProcessing = false;
        }
      });

      // Start sending audio chunks
      this.audioService.audioData$.pipe(
        takeUntil(this.destroy$)
      ).subscribe((audioChunk: AudioChunk) => {
        this.geminiService.sendAudioChunk(audioChunk.data);
      });

    } catch (error) {
      console.error('Error starting conversation:', error);
      this.isProcessing = false;
    }
  }

  private startListening() {
    if (this.isListening) {
      this.audioService.startRecording();
    }
  }

  private stopConversation() {
    this.isListening = false;
    this.audioService.stopRecording();
    this.geminiService.stopAudioStream();
    this.isProcessing = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopConversation();
  }
}