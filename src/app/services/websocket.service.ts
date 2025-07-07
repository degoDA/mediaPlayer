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
  UIMessageDataSource = new BehaviorSubject<any>('');
  newUIMessageData = this.UIMessageDataSource.asObservable();
  profiles: Profile[] = [];
  categories: CategoryItem[] = [];
  mediaPlayerState: MediaPlayerState = {};
  private categoryHistoryStack: any[] = [];
  private currentCategoryRequestMessage: any = null;

  public lastProcessedCategories: CategoryItem[] = [];
  public lastProcessedParentCategoryName?: string;

  connect(url: string, protocol: string): void {
    this.socket = new WebSocket(url, protocol);

    this.socket.onmessage = (event) => {
      // console.log('[WebsocketService] Raw WebSocket message received:', event.data); // Removed
      const rawData = event.data as string;
      const messageParts = rawData.replace(/}\s*{/g, '}\n{').split('\n');

      for (const part of messageParts) {
        if (part.trim() === '') {
          continue;
        }
        try {
          const parsedResponse = JSON.parse(part);
          // console.log('[WebsocketService] Processing parsed message part:', parsedResponse); // Removed

          const actionsPath = parsedResponse?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions;
          if (actionsPath && typeof actionsPath === 'object' && !Array.isArray(actionsPath)) {
            console.warn('[WebsocketService] Received AvailableActions as an object, converting to empty array. Original:', actionsPath); // Kept
            if (parsedResponse.Device?.MediaPlayerNeXt?.Players?.Player01) {
                parsedResponse.Device.MediaPlayerNeXt.Players.Player01.AvailableActions = [];
            }
          }
          this.processResponse(parsedResponse);
          this.messages$.next(parsedResponse);
        } catch (e) {
          console.error('[WebsocketService] Error parsing JSON message part. Part:', part, 'Error:', e); // Kept
          console.error('[WebsocketService] Offending raw data:', event.data); // Kept
        }
      }
    };

    this.socket.onopen = () => {
      this.registerClient();
      this.reportUIMessageData({ connected: true });
    };
    this.socket.onerror = (error) => console.error('WebSocket error', error); // Kept
    this.socket.onclose = () => console.log('WebSocket closed'); // Kept
  }

  registerClient() {
    let msg = { /* ... */ }; // Content omitted for brevity, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  suscribe() {
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  homeScreen() {
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  streamingProviders() {
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  browseProvider(idProvider: string){
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
    this.categoryHistoryStack = [];
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(msg));
  }

  browseCategorie(categoryToEnter: CategoryItem){
    if (this.currentCategoryRequestMessage) {
      this.categoryHistoryStack.push(JSON.parse(JSON.stringify(this.currentCategoryRequestMessage)));
    }
    const newMsg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(newMsg));
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(newMsg));
  }

  playback(item: CategoryItem | MediaItem){
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  playbackAction(action: string){
    let msg = { /* ... */ }; // Content omitted, assumed unchanged
    this.send(JSON.stringify(msg));
  }

  selectBackCategory(): boolean {
    if (this.categoryHistoryStack.length > 0) {
      const previousCategoryRequestMessage = this.categoryHistoryStack.pop();
      if (previousCategoryRequestMessage) {
        this.send(JSON.stringify(previousCategoryRequestMessage));
        this.currentCategoryRequestMessage = previousCategoryRequestMessage;
        return true;
      }
    }
    return false;
  }

  send(message: string): void {
    this.socket?.send(message);
  }

  getMessages(): Observable<string> {
    return this.messages$.asObservable();
  }

  processResponse(response: any) {
    // console.log(response) // Top-level log of full response, keep for now or remove if too verbose
    if ('Device' in response) {
      if (response?.Device?.SubscriptionMgr?.WsConnectionsList?.Ws01?.RegisteredClientList) {
        const clientList = response.Device.SubscriptionMgr.WsConnectionsList.Ws01.RegisteredClientList;
        const firstRcSessionId = Object.keys(clientList)[0];
        if (firstRcSessionId) {
          this.rcSessionId = firstRcSessionId;
          // console.log('[WebsocketService] Client registered. RcSessionId:', this.rcSessionId); // Removed
          this.suscribe();
          this.requestCurrentPlayerStatus();
        } else {
          console.error('[WebsocketService] RegisteredClientList found but no RcSessionId keys.'); // Kept
        }
      }
      if (response?.Device?.SubscriptionMgr?.RegisteredClientList) {
        this.streamingProviders();
      }

      if (response?.Device?.StreamingServices?.UserProfiles) {
        this.profiles = [];
        for (const idProfile in response.Device.StreamingServices.UserProfiles){
          let profile: Profile = {
            idProfile: idProfile,
            name: response.Device.StreamingServices.UserProfiles[idProfile]?.Name,
            providers: [],
          }
          for (const idService in response.Device.StreamingServices.UserProfiles[idProfile]?.AssignedProviders) {
            const service: Provider = {
              idService: idService,
              name: response.Device.StreamingServices.UserProfiles[idProfile]?.AssignedProviders[idService].Name
            }
            if (profile.providers) profile.providers.push(service);
            else profile.providers = [service];
          }
          this.profiles.push(profile);
        }
        this.reportUIMessageData({ profiles: this.profiles });
      }

      const providerBrowseMenuUpdate = response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu;
      if (providerBrowseMenuUpdate) {
        this.categories = [];
        const menuDataItems = providerBrowseMenuUpdate.Categories?.Item01?.MenuDataItems;
        if (menuDataItems) {
            for (const id in menuDataItems) {
              const itemData = menuDataItems[id];
              const category: CategoryItem = {
                idCategorie: id,
                browseItemName: itemData.BrowseItemName,
                signedData: itemData.SignedData,
                urlIcon: itemData.UrlIcon,
                browseKey: itemData.BrowseKey,
                providerKey: itemData.MediaTypeMetaData?.ProviderKey,
                streamingMediaType: itemData.StreamingMediaType,
                artistName: itemData.MediaTypeMetaData?.ArtistName,
                albumName: itemData.MediaTypeMetaData?.AlbumName
              };
              this.categories.push(category);
            }
        }
        const parentBrowseItemName = providerBrowseMenuUpdate.ParentBrowseKey?.BrowseItemName;
        this.lastProcessedCategories = [...this.categories];
        this.lastProcessedParentCategoryName = parentBrowseItemName;
        // console.log('[WebsocketService] Caching last processed categories. Count:', this.lastProcessedCategories.length, 'Parent:', this.lastProcessedParentCategoryName); // Removed
        this.reportUIMessageData({
            categories: this.categories,
            parentCategoryName: parentBrowseItemName,
            type: 'categories'
        });
      }

      if (response?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions) {
        this.mediaPlayerState.availableActions = response.Device.MediaPlayerNeXt.Players.Player01.AvailableActions;
        this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
      }

      const nowPlayingDataPath = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData;
      if (nowPlayingDataPath) {
        if (nowPlayingDataPath.TrackTitle && String(nowPlayingDataPath.TrackTitle).trim() !== '') {
          const newNowPlaying: NowPlayingData = {
            idnowPlaying: 'current',
            trackTitle: String(nowPlayingDataPath.TrackTitle),
            artistName: String(nowPlayingDataPath.ArtistName || ''),
            albumName: String(nowPlayingDataPath.AlbumName || ''),
            stationName: String(nowPlayingDataPath.StationName || ''),
            albumArtUrl: String(nowPlayingDataPath.AlbumArtUrl || ''),
            trackNum: Number(nowPlayingDataPath.TrackNum || 0),
            trackCnt: Number(nowPlayingDataPath.TrackCnt || 0),
            duration: String(nowPlayingDataPath.Duration || '0')
          };
          this.mediaPlayerState.nowPlayingData = newNowPlaying;
          if (nowPlayingDataPath.hasOwnProperty('ElapsedSec')) {
               this.mediaPlayerState.elapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
          }
          this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
        } else {
          console.warn('[WebsocketService] Received NowPlayingData without a valid TrackTitle. Player info will not be updated with this message. Data:', nowPlayingDataPath); // Kept
        }
      }

      const elapsedSecPath = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.ElapsedSec;
      if (elapsedSecPath !== undefined && !nowPlayingDataPath) {
        if (this.mediaPlayerState.nowPlayingData) {
            const newElapsedSec = String(elapsedSecPath || '0');
            if (this.mediaPlayerState.elapsedSec !== newElapsedSec) {
                this.mediaPlayerState.elapsedSec = newElapsedSec;
                this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
            }
        }
      }
      else if (nowPlayingDataPath && nowPlayingDataPath.hasOwnProperty('ElapsedSec') && (!nowPlayingDataPath.TrackTitle || String(nowPlayingDataPath.TrackTitle).trim() === '')) {
          if (this.mediaPlayerState.nowPlayingData && this.mediaPlayerState.nowPlayingData.trackTitle) {
              const newElapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
              if (this.mediaPlayerState.elapsedSec !== newElapsedSec) {
                  this.mediaPlayerState.elapsedSec = newElapsedSec;
                  this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
              }
          }
      }

      if (response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg) {
        this.reportUIMessageData({ msgNotification: response.Device.MediaNavigation.RegisteredClientMenus[this.rcSessionId].Notification.Widget.Msg });
      }

      const searchMenuDataItemsArray = response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu?.Categories?.Item01?.MenuDataItems;
      if (searchMenuDataItemsArray && Array.isArray(searchMenuDataItemsArray)) {
        const searchResults: CategoryItem[] = [];
        for (const itemData of searchMenuDataItemsArray) {
          if (!itemData) continue;

          const resultItem: CategoryItem = {
            idCategorie: itemData.BrowseKey || `search_item_${Math.random().toString(36).substr(2, 9)}`,
            browseItemName: itemData.BrowseItemName || 'Unknown Item',
            signedData: itemData.SignedData !== undefined ? itemData.SignedData : null,
            urlIcon: itemData.UrlIcon,
            browseKey: itemData.BrowseKey || '',
            providerKey: itemData.MediaTypeMetaData?.ProviderKey,
            streamingMediaType: itemData.StreamingMediaType || 'unknown',
            artistName: itemData.MediaTypeMetaData?.ArtistName,
            albumName: itemData.MediaTypeMetaData?.AlbumName
          };

          if (!itemData.BrowseKey) {
            console.warn('[WebsocketService] Search result item (from array) is missing critical BrowseKey. ID was generated. ItemData:', JSON.stringify(itemData));
          }
          searchResults.push(resultItem);
        }
        this.reportUIMessageData({ searchResults: searchResults, type: 'searchResults' });
      } else if (searchMenuDataItemsArray && typeof searchMenuDataItemsArray === 'object' && !Array.isArray(searchMenuDataItemsArray)) {
        const searchResults: CategoryItem[] = [];
        for (const id in searchMenuDataItemsArray) {
            const itemData = searchMenuDataItemsArray[id];
            if (!itemData) continue;

            const resultItem: CategoryItem = {
                idCategorie: id,
                browseItemName: itemData.BrowseItemName || 'Unknown Item',
                signedData: itemData.SignedData !== undefined ? itemData.SignedData : null,
                urlIcon: itemData.UrlIcon,
                browseKey: itemData.BrowseKey || '',
                providerKey: itemData.MediaTypeMetaData?.ProviderKey,
                streamingMediaType: itemData.StreamingMediaType || 'unknown',
                artistName: itemData.MediaTypeMetaData?.ArtistName,
                albumName: itemData.MediaTypeMetaData?.AlbumName
            };

            if (!itemData.BrowseKey) {
              console.warn('[WebsocketService] Search result item (from object) is missing critical BrowseKey. ItemData:', JSON.stringify(itemData));
            }
            searchResults.push(resultItem);
        }
        this.reportUIMessageData({ searchResults: searchResults, type: 'searchResults' });
      } else if (response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu) {
        console.warn('[WebsocketService] SearchMenu results MenuDataItems not found or not a recognized structure. Response path existed.', response.Device.MediaNavigation.RegisteredClientMenus[this.rcSessionId].MenuUpdates.SearchMenu);
        this.reportUIMessageData({ searchResults: [], type: 'searchResults' });
      }
    }
  }

  reportUIMessageData(data: any) {
    this.UIMessageDataSource.next(data);
  }

  public get canNavigateBackInCategory(): boolean {
    return this.categoryHistoryStack.length > 0;
  }

  public searchMedia(
    searchQuery: string,
    profileKey: string,
    searchCategory: string = 'song'
  ): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) { /* ... guard ... */ return; }
    if (!this.rcSessionId) { /* ... guard ... */ return; }
    const resolvedProfileKey = profileKey || environment.profileKey;
    if (!resolvedProfileKey) { /* ... guard ... */ return; }
    const msg = { /* ... */ }; // Content omitted for brevity
    // console.log('[WebsocketService] Sending search request:', JSON.stringify(msg)); // Removed
    this.send(JSON.stringify(msg));
  }

  public requestCurrentPlayerStatus(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) { /* ... guard ... */ return; }
    if (!this.rcSessionId) { /* ... guard ... */ return; }
    if (!environment.playerId) { /* ... guard ... */ return; }
    const msg = { /* ... */ }; // Content omitted for brevity
    // console.log('[WebsocketService] Requesting current player status:', JSON.stringify(msg)); // Removed
    this.send(JSON.stringify(msg));
  }
}
