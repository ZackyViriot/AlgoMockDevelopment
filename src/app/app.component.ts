// src/app/app.component.ts
import { Component } from '@angular/core';
import { VoiceChatComponent } from '../components/voice-chat/voice-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [VoiceChatComponent],
  template: `
    <app-voice-chat></app-voice-chat>
  `,
  styles: []
})
export class AppComponent {
  title = 'AlgoMock';
}