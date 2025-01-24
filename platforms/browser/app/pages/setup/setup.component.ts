import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  IonAccordion,
  IonAccordionGroup,
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonRadio,
  IonRadioGroup,
  IonRow,
  IonText,
  IonTextarea,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { ActiveToolsPipe } from '../../pipes/active-tools/active-tools.pipe';

const UIElements = [
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonLabel,
  IonInput,
  IonTextarea,
  IonRadio,
  IonRadioGroup,
  IonToggle,
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonModal,
  IonHeader,
  IonToolbar,
  IonList,
  IonItem,
  IonListHeader,
  IonChip,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonAccordion,
  IonAccordionGroup,
  IonIcon,
  IonFooter,
];

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, ...UIElements, ActiveToolsPipe],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.css',
})
export class SetupComponent {
  public config: { agentsConfig: any[]; toolsAvailable: any[] } | undefined;
  public readonly forms = new FormArray<FormGroup<any>>([]);
  public selectedFormIndex = -1;
  public get selectedForm() {
    return this.forms.at(this.selectedFormIndex);
  }
  constructor(private http: HttpClient) {
    addIcons({
      close,
    });
  }

  async ionViewWillEnter() {
    // clear forms
    this.forms.clear();
    // load config
    this.config = await this.getAgentsAndToolsConfig();
    // generate forms based on config
    this.config?.agentsConfig?.forEach((agentConfig) =>
      this.forms.push(this.createAgentForm(agentConfig)),
    );
    // remove `Tools` form control of all agents
    this.forms.controls.forEach((form) => form.removeControl('Tools'));
    // loop over form to update `Tools` FormArray values
    this.forms.controls.forEach((form) => {
      const tools = new FormArray([] as any);
      // add tools based on config.toolsAvailable
      this.config?.toolsAvailable?.forEach((tool) => {
        const isToolSelected =
          !!this.config?.agentsConfig?.find(
            (agent) =>
              agent.Name === form.get('Name')?.value &&
              agent?.Tools?.some((t: any) => t.Name === tool.Name),
          ) || false;
        tools.push(
          new FormGroup({
            selected: new FormControl(isToolSelected),
            Name: new FormControl(tool.Name),
            Description: new FormControl(tool.Description),
            Type: new FormControl(tool.Type),
          }),
        );
      });
      form.addControl('Tools', tools);
    });
    console.log(this.forms);
  }

  async getAgentsAndToolsConfig() {
    const req = this.http.get<{ agentsConfig: any[]; toolsAvailable: any[] }>(
      environment.apiEndpoint + '/setup',
    );
    const res = await firstValueFrom(req);
    const { agentsConfig, toolsAvailable } = res;
    return { agentsConfig, toolsAvailable };
  }

  createAgentForm(agentConfig: { [key: string]: any }) {
    // create form group of form array or form control using value type
    const formGroup = new FormGroup({});
    for (const key in agentConfig) {
      if (agentConfig.hasOwnProperty(key)) {
        const value = agentConfig[key];
        if (Array.isArray(value)) {
          const formArray = new FormArray([] as any);
          // loop through array and create form group
          value.forEach((item) => {
            formArray.push(this.createAgentForm(item));
          });
          formGroup.addControl(key, formArray);
        } else if (typeof value === 'object' && value !== null) {
          formGroup.addControl(key, this.createAgentForm(value));
        } else {
          formGroup.addControl(key, new FormControl(value));
        }
      }
    }
    return formGroup;
  }

  async addNewAgent() {
    // clone first form
    const newAgentForm = this.createAgentForm(this.forms.at(0).value);
    // reset form values
    newAgentForm.reset();
    // remove controle `Tools`
    newAgentForm.removeControl('Tools');
    // add tools based on config.toolsAvailable
    const tools = new FormArray([] as any);
    this.config?.toolsAvailable?.forEach((tool) => {
      tools.push(
        new FormGroup({
          selected: new FormControl(false),
          Name: new FormControl(tool.Name),
          Description: new FormControl(tool.Description),
          Type: new FormControl(tool.Type),
        }),
      );
    });
    newAgentForm.addControl('Tools', tools);
    // set default name
    (newAgentForm.get('Name') as any)?.setValue(
      `Agent ${this.forms.length + 1}`,
    );
    // add new agent form
    this.forms.push(newAgentForm);
  }

  async saveConfig() {
    // get agents config
    const formsValues = this.forms.controls.map((form) => form.value);
    // loop over `Tools` values to filter only selected tools & temove `selected` key
    const agentsConfig = formsValues.map((agent) => {
      const tools = agent.Tools.filter((tool: any) => tool.selected);
      return {
        ...agent,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Tools: tools.map(({ selected, ...tool }: any) => tool),
      };
    });
    // send agents config to server
    const req = this.http.post(environment.apiEndpoint + '/setup', {
      agentsConfig,
    });
    const res = await firstValueFrom(req);
    console.log(res);
  }
}
