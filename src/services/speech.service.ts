// services/speech.service.ts

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject } from 'rxjs';

interface SpeechRecognitionError {
  error: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private recognition: any;
  private speechSynthesis: any;
  private voices: SpeechSynthesisVoice[] = [];
  
  public isListening$ = new BehaviorSubject<boolean>(false);
  public speechText$ = new Subject<string>();
  public error$ = new Subject<SpeechRecognitionError>();
  public isSpeaking$ = new BehaviorSubject<boolean>(false);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSpeechRecognition();
      this.initializeSpeechSynthesis();
    }
  }

  private initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.setupRecognitionProperties();
    } else {
      console.error('Speech recognition not supported in this browser');
    }
  }

  private setupRecognitionProperties() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening$.next(true);
    };

    this.recognition.onend = () => {
      this.isListening$.next(false);
      // Don't automatically restart here - we'll handle that in the component
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript !== '') {
        this.speechText$.next(finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.error$.next({
        error: event.error,
        message: this.getErrorMessage(event.error)
      });
      this.isListening$.next(false);
    };
  }

  private initializeSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
      if (this.speechSynthesis.onvoiceschanged !== undefined) {
        this.speechSynthesis.onvoiceschanged = () => {
          this.voices = this.speechSynthesis.getVoices();
        };
      }
    }
  }

  startListening(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (!this.recognition) {
      this.error$.next({
        error: 'not_supported',
        message: 'Speech recognition is not supported in this browser'
      });
      return;
    }

    try {
      if (!this.isListening$.value) {
        this.recognition.start();
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }

  stopListening(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (this.recognition && this.isListening$.value) {
      this.recognition.stop();
    }
  }

  speak(text: string, options: SpeechSynthesisUtterance = new SpeechSynthesisUtterance()): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject('Speech synthesis not supported');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.voice = options.voice || this.voices[0];
      utterance.pitch = options.pitch || 1;
      utterance.rate = options.rate || 1;
      utterance.volume = options.volume || 1;

      utterance.onstart = () => {
        this.isSpeaking$.next(true);
      };

      utterance.onend = () => {
        this.isSpeaking$.next(false);
        resolve();
      };

      utterance.onerror = (error) => {
        this.isSpeaking$.next(false);
        reject(error);
      };

      this.speechSynthesis.speak(utterance);
    });
  }

  cancelSpeech(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.isSpeaking$.next(false);
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  private getErrorMessage(error: string): string {
    const errorMessages: { [key: string]: string } = {
      'no-speech': 'No speech was detected',
      'audio-capture': 'Audio capture failed',
      'not-allowed': 'Microphone permission was denied',
      'network': 'Network error occurred',
      'aborted': 'Speech recognition was aborted',
      'language-not-supported': 'Language is not supported',
      'service-not-allowed': 'Service is not allowed'
    };

    return errorMessages[error] || 'Unknown error occurred';
  }
}