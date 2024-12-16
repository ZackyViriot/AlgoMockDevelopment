// services/gemini.service.ts

import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private chat: any; // Type will depend on Gemini's types

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.API_KEY);
    this.initChat();
  }

  private async initChat() {
    const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" }); // Updated model
    this.chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 100,
      },
    });
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const result = await this.chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

  async streamResponse(message: string) {
    try {
      const result = await this.chat.sendMessageStream(message);
      return result.stream;
    } catch (error) {
      console.error('Error streaming response from Gemini:', error);
      throw error;
    }
  }
}