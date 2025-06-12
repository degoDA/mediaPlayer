import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { v1 as uuidv1 } from 'uuid';
import { Profile, Provider } from '../interfaces/profile.interface';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket?: WebSocket;
  private messages$ = new Subject<string>();
  private rcSessionId: string = '';
  UIMessageDataSource = new BehaviorSubject('');
  newUIMessageData = this.UIMessageDataSource.asObservable();
  profiles: any[] = [];
  categories: any[] = [];
  nowPlaying: any = {};
  backCategory: any = {};
  elapsedSec: string = '0';

  connect(url: string, protocol: string): void {
    this.socket = new WebSocket(url, protocol);

    this.socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      this.processResponse(response);
      this.messages$.next(response);
    };

    this.socket.onopen = () => {
      this.registerClient();
      this.reportUIMessageData({ connected: true });
    };
    this.socket.onerror = (error) => console.error('WebSocket error', error);
    this.socket.onclose = () => console.log('WebSocket closed');
  }

  registerClient() {
    let msg = {
      Device: {
        SubscriptionMgr: {
          RequestAction: {
            MsgId: uuidv1(),
            RegistrationAction: 'RegisterClient',
            RegistrationActionOptions: {
              RegisteringClientIds: [environment.clientId],
            },
          },
        },
      },
    };
    this.send(JSON.stringify(msg));
  }

  suscribe() {
    let msg = {
      Device: {
        SubscriptionMgr: {
          RequestAction: {
            MsgId: uuidv1(),
            RegistrationAction: 'SubscribeToObject',
            RegistrationActionOptions: {
              RcSessionId: this.rcSessionId,
              CresNextPath: [
                '/Device/MediaNavigation/RegisteredClientMenus/' +
                  this.rcSessionId,
                '/Device/MediaFavorites',
                '/Device/MediaPlayerNeXt/Players/Player01',
              ],
            },
          },
        },
      },
    };
    this.send(JSON.stringify(msg));
  }

  homeScreen() {
    let msg = {
      Device: {
        MediaNavigation: {
          RequestAction: {
            RcSessionId: this.rcSessionId,
            MsgId: uuidv1(),
            ProfileKey: environment.profileKey,
            MenuCategory: 'HomeScreenMenu',
            MenuCategoryOptions: {
              HomeScreenCategory: 'All',
              ItemCount: 50,
              ItemOffset: 0,
            },
          },
        },
      },
    };
    this.send(JSON.stringify(msg));
  }

  streamingProviders() {
    let msg = {
      Device: {
        SubscriptionMgr: {
          RequestAction: {
            MsgId: uuidv1(),
            RegistrationAction: 'GetCresNextObject',
            RegistrationActionOptions: {
              RcSessionId: this.rcSessionId,
              CresNextObject:
                '/Device/StreamingServices/UserProfiles/',
            },
          },
        },
      },
    };
    this.send(JSON.stringify(msg));
  }

  browseProvider(idProvider: string){
    let msg = {
      "Device": {
        "MediaNavigation": {
         "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "ProfileKey": environment.profileKey,
            "MenuCategory": "ProviderBrowseMenu",
            "MenuCategoryOptions": {
              "ProviderKey": idProvider,
              "BrowseKey": idProvider,
              "ItemCount": 50,
              "ItemOffset": 0
            }
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
    this.saveCategory(msg)
  }

  browseCategorie(categorie:any){
    let msg = {
      "Device": {
        "MediaNavigation": {
          "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "ProfileKey": environment.profileKey,
            "MenuCategory": "ProviderBrowseMenu",
            "MenuCategoryOptions": {
              "ProviderKey": categorie.providerKey,
              "BrowseKey": categorie.browseKey,
              "ItemCount": 50,
              "ItemOffset": 0,
              "SignedData": categorie.signedData
            }
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
    this.saveCategory(msg)
  }

  playback(categorie:any){
    let msg = {
      "Device": {
        "MediaPlayerNeXt": {
          "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "PlayerId": environment.playerId,
            "ActionId": "LoadSource",
            "ActionIdOptions": {
              "ProfileKey": environment.profileKey,
              "ProviderKey": categorie.browseKey,
              "AudioSourceUrl": "",
              "AutoPlay": true,
              "SignedData": categorie.signedData
            }
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
  }

  playbackAction(action:string){
    let msg = {
      "Device": {
        "MediaPlayerNeXt": {
          "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "PlayerId": environment.playerId,
            "ActionId": action,
            "ActionIdOptions": {}
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
  }

  selectBackCategory(){
    this.send(JSON.stringify(this.backCategory[0]));
    console.log(this.backCategory[0])
  }

  send(message: string): void {
    this.socket?.send(message);
  }

  getMessages(): Observable<string> {
    return this.messages$.asObservable();
  }

  processResponse(response: any) {
    console.log(response)
    if ('Device' in response) {
      if (
        // Response register client
        response?.Device?.SubscriptionMgr?.WsConnectionsList?.Ws01
          ?.RegisteredClientList
      ) {
        for (const key in response.Device.SubscriptionMgr.WsConnectionsList.Ws01
          .RegisteredClientList) {
          this.rcSessionId = key;
          this.suscribe();
        }
      }
      if (
        // Response susscribe
        response?.Device?.SubscriptionMgr?.RegisteredClientList
      )
        this.streamingProviders();

      if (
        // Response providers
        response?.Device?.StreamingServices?.UserProfiles
      ) {
        let profile: Profile = {};
        for (const idProfile in response?.Device?.StreamingServices?.UserProfiles){
          profile = {
            idProfile: idProfile,
            name: response?.Device?.StreamingServices?.UserProfiles[idProfile]?.Name,
            providers: [],
          }
          for (const idService in response?.Device?.StreamingServices?.UserProfiles[idProfile]?.AssignedProviders) {
            const service: Provider = {
              idService: idService,
              name: response?.Device?.StreamingServices?.UserProfiles[idProfile]?.AssignedProviders[idService].Name
            }
            if (profile.providers)
              profile.providers.push(service)
          }
          this.profiles.push(profile)
        }
        this.reportUIMessageData({ profiles: this.profiles });
      }

      if (
        // Response provider categories
        response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems
      ) {
        this.categories = []
        for (const id in response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems) {
          const categories = {
            idCategorie: id,
            browseItemName: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].BrowseItemName,
            signedData: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].SignedData,
            urlIcon: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].UrlIcon,
            browseKey: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].BrowseKey,
            providerKey: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].MediaTypeMetaData?.ProviderKey,
            streamingMediaType: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems[id].StreamingMediaType,
          }
          this.categories.push(categories)
        }
        this.reportUIMessageData({ categories: this.categories });
      }

      if (
        // Response playback actions
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions
      )
        this.reportUIMessageData({ actions: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions });

      if (
        // Response playback nowPlaying
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.TrackTitle
      ){
        for (const id in response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.TrackTitle) {
           this.nowPlaying = {
            idnowPlaying: id,
            trackTitle: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.TrackTitle,
            artistName: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ArtistName,
            albumName: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.AlbumName,
            stationName: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.StationName,
            albumArtUrl: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.AlbumArtUrl,
            trackNum: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.TrackNum,
            trackCnt: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.TrackCnt,
            duration: response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.Duration,
          }
          this.elapsedSec = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ElapsedSec
        }
        this.reportUIMessageData({ nowPlayingData: this.nowPlaying });
        this.reportUIMessageData({ elapsedSec: this.elapsedSec });
      }

      if (
        // Response playback elapsedSec
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ElapsedSec
      ){
        this.elapsedSec = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ElapsedSec,
        this.reportUIMessageData({ elapsedSec: this.elapsedSec });
        console.log('elapsed', this.elapsedSec)
      }

      if (
        // Response playback actions
        response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg
      )
        this.reportUIMessageData({ msgNotification: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg });
    }
  }

  saveCategory(category : any){
    if(this.backCategory[0] == undefined)
      this.backCategory[0] = category
    else{
      if(this.backCategory[1] == undefined)
        this.backCategory[1] = category
      else{
        this.backCategory[0] = this.backCategory[1]
        this.backCategory[1] = category
      }
    }
    console.log('browse',this.backCategory)
  }

  reportUIMessageData(data: any) {
    this.UIMessageDataSource.next(data);
  }

}
