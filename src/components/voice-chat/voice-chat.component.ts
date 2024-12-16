// src/app/components/voice-chat/voice-chat.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../services/audio.service';
import { SpeechService } from '../../services/speech.service';
import { GeminiService } from '../../services/gemini.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-voice-chat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="voice-chat-container">
      <div class="status-bar">
        <div class="status" [class.active]="isListening">
          {{ isListening ? 'Listening...' : 'Click Start to begin' }}
          <span *ngIf="isSpeaking">(AI Speaking...)</span>
        </div>
        <div class="audio-level" *ngIf="isListening">
          <div class="level-bar" [style.height.%]="audioLevel"></div>
        </div>
      </div>

      <div class="messages" #messagesContainer>
        <div *ngFor="let message of messages" 
             [ngClass]="{'user-message': message.isUser, 'ai-message': !message.isUser}">
          {{ message.text }}
        </div>
        <div *ngIf="currentStreamingResponse" 
             class="ai-message streaming">
          {{ currentStreamingResponse }}
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
  styles: [`
    .voice-chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: white;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .status {
      font-size: 14px;
      color: #666;
    }

    .status.active {
      color: #007bff;
      font-weight: bold;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: white;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .user-message, .ai-message {
      padding: 12px 16px;
      margin: 8px 0;
      border-radius: 12px;
      max-width: 80%;
      word-wrap: break-word;
    }

    .user-message {
      background-color: #007bff;
      color: white;
      margin-left: auto;
    }

    .ai-message {
      background-color: #e9ecef;
      color: #212529;
      margin-right: auto;
    }

    .streaming {
      opacity: 0.7;
      position: relative;
    }

    .streaming::after {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #007bff;
      margin-left: 8px;
      animation: blink 1s infinite;
    }

    .controls {
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    button {
      padding: 12px 24px;
      border-radius: 24px;
      border: none;
      background-color: #007bff;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    button:hover {
      background-color: #0056b3;
      transform: translateY(-1px);
    }

    button.active {
      background-color: #dc3545;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    .audio-level {
      width: 20px;
      height: 40px;
      border: 1px solid #ccc;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    }

    .level-bar {
      width: 100%;
      background-color: #007bff;
      position: absolute;
      bottom: 0;
      transition: height 0.1s;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `]
})
export class VoiceChatComponent implements OnInit, OnDestroy {
  messages: Array<{ text: string; isUser: boolean }> = [];
  isListening = false;
  isProcessing = false;
  isSpeaking = false;
  audioLevel = 0;
  currentStreamingResponse = '';
  private destroy$ = new Subject<void>();
  private processingTimeout: any;

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
        this.audioLevel = (level / 255) * 100;
        this.cdr.detectChanges();
      });

    // Speech recognition results
    this.speechService.speechText$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async text => {
        if (text.trim()) {
          clearTimeout(this.processingTimeout);
          this.addMessage(text, true);
          await this.getGeminiResponse(text);
        }
      });

    // Recording state
    this.audioService.isRecording$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isRecording => {
        this.isListening = isRecording;
        this.cdr.detectChanges();
      });

    // Speaking state
    this.speechService.isSpeaking$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSpeaking => {
        this.isSpeaking = isSpeaking;
        if (!isSpeaking && this.isListening) {
          // Resume listening after speaking
          this.speechService.startListening();
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
      await this.audioService.startRecording();
      this.speechService.startListening();
      this.isProcessing = false;
    } catch (error) {
      console.error('Error starting conversation:', error);
      this.isProcessing = false;
    }
  }

  private stopConversation() {
    this.audioService.stopRecording();
    this.speechService.stopListening();
    this.currentStreamingResponse = '';
    this.isProcessing = false;
  }

  private async getGeminiResponse(text: string) {
    try {
      this.isProcessing = true;
      this.currentStreamingResponse = '';

      // Temporarily pause listening while getting and speaking response
      this.speechService.stopListening();

      const stream = await this.geminiService.streamResponse(text);
      let fullResponse = '';

      for await (const chunk of stream) {
        const chunkText = chunk.text();
        this.currentStreamingResponse += chunkText;
        fullResponse += chunkText;
        this.cdr.detectChanges();
      }

      // Add final response to messages
      this.addMessage(fullResponse, false);
      this.currentStreamingResponse = '';

      // Speak the response
      await this.speechService.speak(fullResponse);

      // Resume listening if still in conversation mode
      if (this.isListening) {
        this.speechService.startListening();
      }

      // Reset processing state after a delay
      this.processingTimeout = setTimeout(() => {
        this.isProcessing = false;
        this.cdr.detectChanges();
      }, 1000);

    } catch (error) {
      console.error('Error getting Gemini response:', error);
      this.addMessage('Sorry, I encountered an error.', false);
      this.isProcessing = false;
      
      // Resume listening on error if still in conversation mode
      if (this.isListening) {
        this.speechService.startListening();
      }
    }
  }

  private addMessage(text: string, isUser: boolean) {
    this.messages.push({ text, isUser });
    this.cdr.detectChanges();
    
    // Scroll to bottom on next tick
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.processingTimeout);
    this.stopConversation();
  }
}