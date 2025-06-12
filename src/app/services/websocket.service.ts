import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { v1 as uuidv1 } from 'uuid';
import { Profile, Provider } from '../interfaces/profile.interface';
import { CategoryItem } from '../interfaces/category.interface';
import { MediaItem } from '../interfaces/media.interface';
import { NowPlayingData, PlaybackAction, MediaPlayerState } from '../interfaces/player.interface';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket?: WebSocket;
  private messages$ = new Subject<string>();
  private rcSessionId: string = '';
  UIMessageDataSource = new BehaviorSubject<any>(''); // Keep any for now, or define a UIMessage interface
  newUIMessageData = this.UIMessageDataSource.asObservable();
  profiles: Profile[] = [];
  categories: CategoryItem[] = [];
  // nowPlaying: NowPlayingData = {} as NowPlayingData; // Will be part of mediaPlayerState
  // elapsedSec: string = '0'; // Will be part of mediaPlayerState
  mediaPlayerState: MediaPlayerState = {};
  public backCategory: any = {}; // Made public for CategoryNavigationComponent's isAtRootLevel

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
    this.saveCategory(msg) // Consider if msg matches CategoryItem or if mapping is needed
  }

  browseCategorie(category: CategoryItem){ // Updated type
    let msg = {
      "Device": {
        "MediaNavigation": {
          "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "ProfileKey": environment.profileKey,
            "MenuCategory": "ProviderBrowseMenu",
            "MenuCategoryOptions": {
              "ProviderKey": category.providerKey,
              "BrowseKey": category.browseKey,
              "ItemCount": 50,
              "ItemOffset": 0,
              "SignedData": category.signedData
            }
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
    this.saveCategory(category); // Pass the category object
  }

  playback(item: CategoryItem | MediaItem){ // Updated type to allow MediaItem as well
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
              // Assuming browseKey from CategoryItem or MediaItem is used as ProviderKey here
              "ProviderKey": item.browseKey,
              "AudioSourceUrl": "", // This might need to be populated from item if available
              "AutoPlay": true,
              "SignedData": item.signedData
            }
          }
        }
      }
    }
    this.send(JSON.stringify(msg));
  }

  playbackAction(action: string){ // Action could be typed if specific actions are known e.g. 'PlayPause' | 'Next'
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
        this.profiles = []; // Initialize to ensure it's empty before processing
        for (const idProfile in response?.Device?.StreamingServices?.UserProfiles){
          let profile: Profile = { // Explicitly type here
            idProfile: idProfile,
            name: response?.Device?.StreamingServices?.UserProfiles[idProfile]?.Name,
            providers: [],
          }
          for (const idService in response?.Device?.StreamingServices?.UserProfiles[idProfile]?.AssignedProviders) {
            const service: Provider = { // Explicitly type here
              idService: idService,
              name: response?.Device?.StreamingServices?.UserProfiles[idProfile]?.AssignedProviders[idService].Name
            }
            if (profile.providers)
              profile.providers.push(service);
            else
              profile.providers = [service]; // Initialize if undefined
          }
          this.profiles.push(profile);
        }
        this.reportUIMessageData({ profiles: this.profiles });
      }

      if (
        // Response provider categories
        response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu?.Categories?.Item01?.MenuDataItems
      ) {
        this.categories = []; // Initialize to ensure it's empty
        const menuDataItems = response.Device.MediaNavigation.RegisteredClientMenus[this.rcSessionId].MenuUpdates.ProviderBrowseMenu.Categories.Item01.MenuDataItems;
        for (const id in menuDataItems) {
          const item = menuDataItems[id];
          const category: CategoryItem = { // Explicitly type here
            idCategorie: id, // Or item.id if available and preferred
            browseItemName: item.BrowseItemName,
            signedData: item.SignedData,
            urlIcon: item.UrlIcon,
            browseKey: item.BrowseKey,
            providerKey: item.MediaTypeMetaData?.ProviderKey, // Optional chaining for safety
            streamingMediaType: item.StreamingMediaType,
          };
          this.categories.push(category);
        }
        this.reportUIMessageData({ categories: this.categories });
      }

      if (
        // Response playback actions
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions
      ) {
        this.mediaPlayerState.availableActions = response.Device.MediaPlayerNeXt.Players.Player01.AvailableActions as PlaybackAction;
        this.reportUIMessageData({ mediaPlayerState: this.mediaPlayerState });
      }

      if (
        // Response playback nowPlaying (includes ElapsedSec)
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData
      ){
        const nowPlayingDataResp = response.Device.MediaPlayerNeXt.Players.Player01.Player.NowPlayingData;
        const currentNowPlaying: NowPlayingData = {
          idnowPlaying: nowPlayingDataResp.idnowPlaying || this.mediaPlayerState.nowPlayingData?.idnowPlaying || uuidv1(),
          trackTitle: nowPlayingDataResp.TrackTitle,
          artistName: nowPlayingDataResp.ArtistName,
          albumName: nowPlayingDataResp.AlbumName,
          stationName: nowPlayingDataResp.StationName,
          albumArtUrl: nowPlayingDataResp.AlbumArtUrl,
          trackNum: nowPlayingDataResp.TrackNum,
          trackCnt: nowPlayingDataResp.TrackCnt,
          duration: nowPlayingDataResp.Duration,
        };
        this.mediaPlayerState.nowPlayingData = currentNowPlaying;
        if (nowPlayingDataResp.ElapsedSec !== undefined) {
          this.mediaPlayerState.elapsedSec = nowPlayingDataResp.ElapsedSec;
        }
        this.reportUIMessageData({ mediaPlayerState: this.mediaPlayerState });
      }

      // This specific block for ElapsedSec might be redundant if NowPlayingData always includes it
      // However, if ElapsedSec can update independently, it's needed.
      if (
        response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ElapsedSec !== undefined &&
        this.mediaPlayerState.nowPlayingData // Only update elapsedSec if nowPlayingData is set
      ){
        this.mediaPlayerState.elapsedSec = response.Device.MediaPlayerNeXt.Players.Player01.Player.NowPlayingData.ElapsedSec;
        this.reportUIMessageData({ mediaPlayerState: this.mediaPlayerState });
        // console.log('elapsed', this.mediaPlayerState.elapsedSec); // Keep for debugging if necessary
      }

      if (
        // Response playback actions
        response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg
      )
        this.reportUIMessageData({ msgNotification: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg });
    }
  }

  saveCategory(category : CategoryItem | any){ // Updated type, though 'any' might still be needed if msg is passed
    // This logic might need review if 'category' is now always CategoryItem
    // and 'msg' (the raw message) was intended for backCategory
    if(this.backCategory[0] == undefined)
      this.backCategory[0] = category;
    else{
      if(this.backCategory[1] == undefined)
        this.backCategory[1] = category;
      else{
        this.backCategory[0] = this.backCategory[1];
        this.backCategory[1] = category;
      }
    }
    console.log('browse',this.backCategory);
  }

  reportUIMessageData(data: any) {
    this.UIMessageDataSource.next(data);
  }

}
