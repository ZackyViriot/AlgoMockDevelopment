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
          this.listAvailableVoices();
        };
      }
    }
  }

  listAvailableVoices(): void {
    if (this.speechSynthesis) {
      const voices = this.speechSynthesis.getVoices();
      type VoiceInfo = {
        name: string;
        lang: string;
        default: boolean;
        localService: boolean;
      };
      
      const voiceInfo: VoiceInfo[] = voices.map((voice: SpeechSynthesisVoice) => ({
        name: voice.name,
        lang: voice.lang,
        default: voice.default,
        localService: voice.localService
      }));
      
      console.log('Available voices:', voiceInfo);
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

  speak(text: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject('Speech synthesis not supported');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Get all available voices
      this.voices = this.speechSynthesis.getVoices();
      
      // Set English Female as primary preference
      const preferredVoices = [
        "Google UK English Female",
        "Microsoft Susan Mobile", // UK English Female
        "en-GB-Standard-Female",
        "British English Female"
      ];

      // Find the first available preferred voice
      const selectedVoice = this.voices.find(voice => 
        preferredVoices.includes(voice.name)
      );

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using voice:', selectedVoice.name);
      } else {
        // Find any English female voice as fallback
        const englishFemaleVoice = this.voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
        );
        if (englishFemaleVoice) {
          utterance.voice = englishFemaleVoice;
          console.log('Using fallback voice:', englishFemaleVoice.name);
        }
      }

      // Adjusted for English Female voice
      utterance.pitch = 1.0;  // Natural pitch
      utterance.rate = 0.95;  // Slightly slower for clarity
      utterance.volume = 1.0; // Full volume

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