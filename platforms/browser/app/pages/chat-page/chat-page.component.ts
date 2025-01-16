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
  ModalController,
  IonAvatar,
  IonButtons,
} from '@ionic/angular/standalone';
import { sendOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AppService } from '../../app.service';
import { Observable, tap } from 'rxjs';
import { ConnectUserModalComponent } from '../../components/connect-user-modal/connect-user-modal.component';

const UIElements = [
  IonApp,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonInput,
  IonButton,
  IonIcon,
  IonAvatar,
  IonButtons,
];
@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...UIElements],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
})
export class ChatPageComponent implements AfterViewInit {
  @ViewChild('content') private content!: IonContent;
  private readonly _platform = inject(PLATFORM_ID);
  private readonly _document = inject(DOCUMENT);
  public readonly userAccount$: Observable<`0x${string}` | undefined>;

  constructor(
    private readonly _appService: AppService,
    private readonly _modalCtrl: ModalController,
  ) {
    this.userAccount$ = this._appService.account$.asObservable().pipe(
      tap(async (account) => {
        if (!account) {
          const modal = await this._modalCtrl.create({
            component: ConnectUserModalComponent,
            backdropDismiss: false,
            keyboardClose: false,
          });
          await modal.present();
        } else {
          const existingModal = await this._modalCtrl.getTop();
          if (existingModal) {
            await existingModal.dismiss();
          }
        }
      }),
    );
    // define ionicons
    addIcons({ 'send-outline': sendOutline });
    // use `afterNextRender` to scroll to bottom on server side rendering
    if (isPlatformServer(this._platform)) {
      afterNextRender(() => {
        this.scrollToBottom();
      });
    }
  }

  /**
   * Scroll to the bottom of the messages container after the view is initialized.
   * Only works on the browser.
   */
  ngAfterViewInit() {
    if (isPlatformBrowser(this._platform)) {
      this.scrollToBottom();
    }
  }

  /**
   * Form control for the message input.
   */
  public readonly messageInput = new FormControl('');
  /**
   * Array of messages to display in the chat.
   */
  public readonly messages: Array<{
    text: string;
    type: 'user' | 'assistant';
  }> = [{ text: 'How can I help you today?', type: 'assistant' }];
  currentThreadId?: string;

  /**
   * Scroll to the bottom of the messages container.
   */
  private async scrollToBottom() {
    try {
      await this.content.scrollToBottom(300);
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  /**
   * Send a message to the assistant.
   * @param event
   */
  async sendMessage(event: Event) {
    event.preventDefault();
    const message = this.messageInput.value?.trim();
    if (!message) return;

    this.messages.push({ text: message, type: 'user' });
    this.messageInput.reset();
    await this.scrollToBottom();

    try {
      if (message === ':test') {
        const { data = '' } = await this._appService.ping();
        this.messages.push({ text: data, type: 'assistant' });
        await this.scrollToBottom();
        return;
      }

      if (message === ':logs') {
        const { data = [] } = await this._appService.logs();
        this.messages.push({ text: data.join('\n'), type: 'assistant' });
        await this.scrollToBottom();
        return;
      }

      const { data } = await this._appService.prompt({
        userInput: message,
        threadId: this.currentThreadId,
      });
      this.currentThreadId = data.threadId;
      this.messages.push({
        text: data?.message || 'No response',
        type: 'assistant',
      });
      await this.scrollToBottom();
    } catch (error: any) {
      console.error('Error:', error);
      const message = error?.error?.message || error?.message || error.data;
      this.messages.push({
        text:
          message || 'Sorry, I encountered an error processing your request.',
        type: 'assistant',
      });
      await this.scrollToBottom();
    }
  }

  async disconnectUser() {
    await this._appService.disconnectWallet();
  }
}
