import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebsocketService } from './services/websocket.service';
import { environment } from '../environments/environment.prod';
import { Profile } from './interfaces/profile.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  message = '';
  messages: string[] = [];
  isConnected: boolean = false;
  profiles: any[] = [];
  categories: any[] = [];
  actions: any[] = [];
  nowPlayingData: any = {};
  msgNotification: string = '';
  currentProfile: Profile = {};
  elapsedSec: string = '';
  private subscriptions: any[] = [];

  constructor(private websocketService: WebsocketService) {
    this.websocketService.connect(
      environment.websocketUrl,
      environment.protocol
    );
    this.websocketService
      .getMessages()
      .subscribe((msg) => this.messages.push(msg));
  }

  send(): void {
    if (this.message.trim()) {
      this.websocketService.send(this.message);
      this.message = '';
    }
  }

  ngOnInit(): void {
    //Get messages to show to the user
    this.subscriptions.push(this.websocketService.newUIMessageData.subscribe((value:any) => {
      //this.utilitiesService.printDebugStatement("newUIMessageData", value);
      this.msgNotification = '';
      if (value && value.hasOwnProperty('connected')) {
        this.isConnected = value['connected'];
        //this.utilitiesService.printDebugStatement("Connected to API", this.isConnected);
      }

      if (value && value.hasOwnProperty('profiles')) {
        this.profiles = value['profiles']
        this.currentProfile = this.profiles[0]
      }

      if (value && value.hasOwnProperty('categories')) {
        this.categories = value['categories']
      }

      if (value && value.hasOwnProperty('actions')) {
        this.actions = value['actions']
      }

      if (value && value.hasOwnProperty('nowPlayingData')) {
        this.nowPlayingData = value['nowPlayingData'] || {}
      }

      if (value && value.hasOwnProperty('elapsedSec')) {
        this.elapsedSec = value['elapsedSec'] || {}
      }

      if (value && value.hasOwnProperty('msgNotification')) {
        this.msgNotification = value['msgNotification'] || {}
      }

    }));
  }

  selectSreaming(service:any) {
    this.websocketService.browseProvider(service.idService)
  }

  selectCategorie(categorie:any) {
    if('streamingMediaType' in categorie){
      if(categorie?.streamingMediaType == 'dirmenu')
        this.websocketService.browseCategorie(categorie)
      else
        this.websocketService.playback(categorie)
    }
    else
      this.websocketService.browseCategorie(categorie)
  }

  selectBackCategorie(){
    this.websocketService.selectBackCategory();
  }

  setCurrentProfile(event:any){
    this.currentProfile = this.profiles.filter((p : Profile) => p.idProfile === event.target?.value)[0]
  }

  executeAction(action:string){
    console.log(action);
    this.websocketService.playbackAction(action);
  }
  retryLoad() {
    location.reload();
  }
}
