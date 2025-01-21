import {
  Component,
  ViewChild,
  AfterViewInit,
  afterNextRender,
  inject,
  PLATFORM_ID,
  OnDestroy,
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
  AlertController,
  IonSpinner,
} from '@ionic/angular/standalone';
import { navigateOutline, powerOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AppService } from '../../app.service';
import { filter, map, Observable, Subscription, tap } from 'rxjs';
import { ConnectUserModalComponent } from '../../components/connect-user-modal/connect-user-modal.component';
import { SafeHtmlPipe } from '../safe-html.pipe';
import { SseService } from '../../sse.service';

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
  IonSpinner,
];
@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SafeHtmlPipe, ...UIElements],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
})
export class ChatPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('content') private content!: IonContent;
  private readonly _platform = inject(PLATFORM_ID);
  private readonly _document = inject(DOCUMENT);
  private readonly _subscriptions: Subscription[] = [];
  public readonly userAccount$: Observable<`0x${string}` | undefined>;
  /**
   * Boolean indicating whether a response is pending from the server.
   * Is use to display a loading dots animation & disable the input.
   */
  public isPendingResponse: boolean = false;

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
  }> = [];
  currentThreadId?: string;

  constructor(
    private readonly _appService: AppService,
    private readonly _sseService: SseService,
    private readonly _modalCtrl: ModalController,
  ) {
    const sub = this._sseService
      .createEventSource()
      .pipe(
        map(({ chat }) => chat),
        filter((chat) => !!chat),
      )
      .subscribe((data) => {
        this.messages.push({
          text: data.message,
          type: 'assistant',
        });
        this.scrollToBottom();
      });
    this._subscriptions.push(sub);
    this.userAccount$ = this._appService.account$.pipe(
      tap(async (account) => {
        const existingModal = await this._modalCtrl.getTop();
        if (!account && !existingModal) {
          const modal = await this._modalCtrl.create({
            component: ConnectUserModalComponent,
            backdropDismiss: false,
            keyboardClose: false,
          });
          await modal.present();
        }
        if (account) {
          if (existingModal) {
            await existingModal.dismiss();
          }
          if (this.messages.length === 0) {
            this.messages.push({
              text: 'Hi darling. How can I help you today?',
              type: 'assistant',
            });
          }
        }
      }),
    );
    // define ionicons
    addIcons({ navigateOutline, powerOutline });
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
   * Unsubscribe from all subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    // close ssl connection
    this._sseService.close();
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

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
    this.isPendingResponse = true;
    this.messages.push({
      text: ``,
      type: 'assistant',
    });
    const lastMessage = this.messages[this.messages.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 250));
    await this.scrollToBottom();

    try {
      if (message === ':test') {
        const { data = '' } = await this._appService.ping();
        this.isPendingResponse = false;
        lastMessage.text = data;
        await this.scrollToBottom();
        return;
      }

      if (message === ':logs') {
        const { data = [] } = await this._appService.logs();
        this.isPendingResponse = false;
        lastMessage.text = data.join('\n');
        await this.scrollToBottom();
        return;
      }

      const { data } = await this._appService.prompt({
        userInput: message,
        threadId: this.currentThreadId,
      });
      if (data.threadId) {
        this.currentThreadId = data.threadId;
      }
      this.isPendingResponse = false;
      lastMessage.text = data?.message || 'No response';
      await this.scrollToBottom();
    } catch (error: any) {
      console.error('Error:', error);
      this.isPendingResponse = false;
      lastMessage.text = error?.error?.message || error?.message || error.data;
      await this.scrollToBottom();
    }
  }

  /**
   * Prompt user to ensure they want to disconnect.
   */
  async disconnectUser() {
    const ionAlert = await new AlertController().create({
      header: 'Disconnect Wallet',
      message: 'Are you sure you want to disconnect your wallet?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Disconnect',
          role: 'ok',
        },
      ],
    });
    await ionAlert.present();
    const { role } = await ionAlert.onDidDismiss();
    if (role !== 'ok') {
      return;
    }
    await this._appService.disconnectWallet();
  }
}
