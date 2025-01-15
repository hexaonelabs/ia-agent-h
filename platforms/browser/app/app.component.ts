import {
  Component,
  ViewChild,
  AfterViewInit,
  afterNextRender,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  CommonModule,
  DOCUMENT,
  isPlatformBrowser,
  isPlatformServer,
} from '@angular/common';
import {
  IonApp,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonInput,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { sendOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonApp,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonInput,
    IonButton,
    IonIcon,
  ],
  host: { ngSkipHydration: 'true' },
  template: `
    <ion-app>
      <div
        class="min-h-screen flex flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-teal-800"
      >
        <ion-header class="glass ion-no-border">
          <ion-toolbar class="glass">
            <ion-title class="text-2xl font-bold text-white text-center"
              >Agent H</ion-title
            >
          </ion-toolbar>
        </ion-header>

        <ion-content #content class="ion-padding">
          <div class="messages-container px-4 py-6 space-y-4">
            <div
              *ngFor="let message of messages"
              class="animate-fade-in animate-slide-up flex"
              [class.justify-end]="message.type === 'user'"
              [class.justify-start]="message.type === 'assistant'"
            >
              <div
                [ngClass]="{
                  'max-w-[85%] p-4 rounded-2xl break-words text-white': true,
                  'bg-white/20': message.type === 'user',
                  'bg-white/10': message.type === 'assistant',
                }"
              >
                {{ message.text }}
              </div>
            </div>
          </div>
        </ion-content>

        <ion-footer class="glass ion-no-border">
          <form
            (submit)="sendMessage($event)"
            class="p-4 flex items-center gap-2"
          >
            <ion-input
              [formControl]="messageInput"
              class="flex-grow p-3 rounded-xl bg-white/10 border border-white/20 text-white"
              placeholder="Type your message..."
              fill="solid"
            ></ion-input>
            <ion-button type="submit" [strong]="true">
              <ion-icon slot="icon-only" name="send-outline"></ion-icon>
            </ion-button>
          </form>
        </ion-footer>
      </div>
    </ion-app>
  `,
})
export class App implements AfterViewInit {
  @ViewChild('content') private content!: IonContent;
  private readonly _platform = inject(PLATFORM_ID);
  private readonly _document = inject(DOCUMENT);

  constructor() {
    addIcons({ 'send-outline': sendOutline });
    if (isPlatformServer(this._platform)) {
      afterNextRender(() => {
        this.scrollToBottom();
      });
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this._platform)) {
      this.scrollToBottom();
    }
  }

  messageInput = new FormControl('');
  messages: Array<{ text: string; type: 'user' | 'assistant' }> = [
    { text: 'How can I help you today?', type: 'assistant' },
  ];
  currentThreadId?: string;

  private async scrollToBottom() {
    try {
      await this.content.scrollToBottom(300);
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  async sendMessage(event: Event) {
    event.preventDefault();
    const message = this.messageInput.value?.trim();
    if (!message) return;

    this.messages.push({ text: message, type: 'user' });
    this.messageInput.reset();
    await this.scrollToBottom();

    try {
      if (message === ':test') {
        const response = await fetch('/api/test');
        const { data = [] } = await response.json();
        this.messages.push({ text: data.join('\n'), type: 'assistant' });
        await this.scrollToBottom();
        return;
      }

      if (message === ':logs') {
        const response = await fetch('/api/logs');
        const { data = [] } = await response.json();
        this.messages.push({ text: data.join('\n'), type: 'assistant' });
        await this.scrollToBottom();
        return;
      }

      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: message,
          threadId: this.currentThreadId,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const { data = {} } = await response.json();
      this.currentThreadId = data?.threadId;
      this.messages.push({
        text: data?.message || 'No response',
        type: 'assistant',
      });
      await this.scrollToBottom();
    } catch (error) {
      console.error('Error:', error);
      this.messages.push({
        text: 'Sorry, I encountered an error processing your request.',
        type: 'assistant',
      });
      await this.scrollToBottom();
    }
  }
}
