import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { v1 as uuidv1 } from 'uuid';
import { Profile, Provider } from '../interfaces/profile.interface';
import { CategoryItem } from '../interfaces/category.interface';
import { MediaItem } from '../interfaces/media.interface';
import { NowPlayingData, MediaPlayerState } from '../interfaces/player.interface'; // PlaybackAction interface might be unused now

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket?: WebSocket;
  private messages$ = new Subject<string>(); // For raw messages, if ever needed
  public rcSessionId: string = ''; // Made public for easier access if MainPlayerView needs it for direct calls (though search uses profileKey)

  // UIMessageDataSource is the main observable for components to get structured data
  public UIMessageDataSource = new BehaviorSubject<any>({}); // Initialize with empty object
  public newUIMessageData = this.UIMessageDataSource.asObservable();

  public profiles: Profile[] = [];
  public categories: CategoryItem[] = [];
  public mediaPlayerState: MediaPlayerState = {};

  private categoryHistoryStack: any[] = [];
  private currentCategoryRequestMessage: any = null;

  // Caching for restoring category view
  public lastProcessedCategories: CategoryItem[] = [];
  public lastProcessedParentCategoryName?: string;

  constructor() {}

  connect(url: string, protocol: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('[WebsocketService] WebSocket already connected or connecting.');
      return;
    }
    console.log('[WebsocketService] Connecting to:', url, 'with protocol:', protocol);
    this.socket = new WebSocket(url, protocol);

    this.socket.onmessage = (event) => {
      const rawData = event.data as string;
      const messageParts = rawData.replace(/}\s*{/g, '}\n{').split('\n');

      for (const part of messageParts) {
        if (part.trim() === '') continue;
        try {
          const parsedResponse = JSON.parse(part);

          const actionsPath = parsedResponse?.Device?.MediaPlayerNeXt?.Players?.[environment.playerId]?.AvailableActions;
          if (actionsPath && typeof actionsPath === 'object' && !Array.isArray(actionsPath)) {
            console.warn('[WebsocketService] Received AvailableActions as an object, converting to empty array. Original:', actionsPath); // Kept
            if (parsedResponse.Device?.MediaPlayerNeXt?.Players?.[environment.playerId]) {
                parsedResponse.Device.MediaPlayerNeXt.Players[environment.playerId].AvailableActions = [];
            }
          }
          this.processResponse(parsedResponse);
          // this.messages$.next(parsedResponse); // Raw message stream not primary focus
        } catch (e) {
          console.error('[WebsocketService] Error parsing JSON message part. Part:', part, 'Error:', e); // Kept
          // console.error('[WebsocketService] Offending raw data:', event.data); // Redundant with part
        }
      }
    };

    this.socket.onopen = () => {
      console.log('[WebsocketService] WebSocket connection opened.'); // Kept
      this.registerClient();
      this.reportUIMessageData({ connected: true, type: 'connectionStatus' });
    };
    this.socket.onerror = (error) => console.error('[WebsocketService] WebSocket error:', error); // Kept
    this.socket.onclose = (event) => {
      console.log('[WebsocketService] WebSocket closed.', event); // Kept
      this.rcSessionId = '';
      this.reportUIMessageData({ connected: false, type: 'connectionStatus' });
      // Optionally implement reconnection logic here
    };
  }

  private send(message: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      console.error('[WebsocketService] WebSocket not connected. Cannot send message:', message); // Kept
    }
  }

  private reportUIMessageData(data: any): void {
    this.UIMessageDataSource.next(data);
  }

  public registerClient(): void {
    const msg = {
      Device: { SubscriptionMgr: { RequestAction: {
        MsgId: uuidv1(),
        RegistrationAction: 'RegisterClient',
        RegistrationActionOptions: { RegisteringClientIds: [environment.clientId] },
      }}},
    };
    this.send(JSON.stringify(msg));
  }

  public subscribeToCoreObjects(): void { // Renamed for clarity
    if (!this.rcSessionId) {
        console.warn('[WebsocketService] Cannot subscribe: rcSessionId is not set.');
        return;
    }
    const msg = {
      Device: { SubscriptionMgr: { RequestAction: {
        MsgId: uuidv1(),
        RegistrationAction: 'SubscribeToObject',
        RegistrationActionOptions: {
          RcSessionId: this.rcSessionId,
          CresNextPath: [
            `/Device/MediaNavigation/RegisteredClientMenus/\${this.rcSessionId}`,
            '/Device/MediaFavorites',
            `/Device/MediaPlayerNeXt/Players/\${environment.playerId}`,
          ],
        },
      }}},
    };
    this.send(JSON.stringify(msg));
  }

  public requestCurrentPlayerStatus(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.rcSessionId) {
      console.warn('[WebsocketService] Cannot request player status: WebSocket not ready or no rcSessionId.'); // Kept
      return;
    }
    if (!environment.playerId) {
      console.error('[WebsocketService] environment.playerId is not defined. Cannot request player status.'); // Kept
      return;
    }
    const msg = { Device: { SubscriptionMgr: { RequestAction: {
      MsgId: uuidv1(),
      RegistrationAction: "GetCresNextObject",
      RegistrationActionOptions: {
        RcSessionId: this.rcSessionId,
        CresNextObject: `/Device/MediaPlayerNeXt/Players/\${environment.playerId}`
      }
    }}}};
    this.send(JSON.stringify(msg));
  }

  public streamingProviders(): void {
    if (!this.rcSessionId) { console.warn('[WebsocketService] No rcSessionId for streamingProviders'); return; }
    const msg = { Device: { SubscriptionMgr: { RequestAction: {
      MsgId: uuidv1(),
      RegistrationAction: 'GetCresNextObject',
      RegistrationActionOptions: { RcSessionId: this.rcSessionId, CresNextObject: '/Device/StreamingServices/UserProfiles/' },
    }}}};
    this.send(JSON.stringify(msg));
  }

  public browseProvider(idProvider: string): void {
    if (!this.rcSessionId) { console.warn('[WebsocketService] No rcSessionId for browseProvider'); return; }
    const msg = { Device: { MediaNavigation: { RequestAction: {
      RcSessionId: this.rcSessionId, MsgId: uuidv1(), ProfileKey: environment.profileKey,
      MenuCategory: 'ProviderBrowseMenu',
      MenuCategoryOptions: { ProviderKey: idProvider, BrowseKey: idProvider, ItemCount: 50, ItemOffset: 0 }
    }}}};
    this.send(JSON.stringify(msg));
    this.categoryHistoryStack = [];
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(msg));
  }

  public browseCategorie(categoryToEnter: CategoryItem): void {
    if (!this.rcSessionId) { console.warn('[WebsocketService] No rcSessionId for browseCategorie'); return; }
    if (this.currentCategoryRequestMessage) {
      this.categoryHistoryStack.push(JSON.parse(JSON.stringify(this.currentCategoryRequestMessage)));
    }
    const newMsg = { Device: { MediaNavigation: { RequestAction: {
      RcSessionId: this.rcSessionId, MsgId: uuidv1(), ProfileKey: environment.profileKey,
      MenuCategory: 'ProviderBrowseMenu',
      MenuCategoryOptions: {
        ProviderKey: categoryToEnter.providerKey, BrowseKey: categoryToEnter.browseKey,
        ItemCount: 50, ItemOffset: 0, SignedData: categoryToEnter.signedData
      }
    }}}};
    this.send(JSON.stringify(newMsg));
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(newMsg));
  }

  public searchMedia(searchQuery: string, profileKey: string, searchCategory: string = 'song'): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.rcSessionId) {
      console.warn('[WebsocketService] WebSocket/Session not ready for search.'); return; // Kept
    }
    const resolvedProfileKey = profileKey || environment.profileKey;
    if (!resolvedProfileKey) {
      console.warn('[WebsocketService] No profileKey for search.'); return; // Kept
    }
    const msg = { Device: { MediaNavigation: { RequestAction: {
      RcSessionId: this.rcSessionId, MsgId: uuidv1(), ProfileKey: resolvedProfileKey,
      MenuCategory: 'SearchMenu',
      MenuCategoryOptions: {
        SearchProviderKey: 'ALL', SearchText: searchQuery, SearchCategory: searchCategory,
        ItemCount: 50, ItemOffset: 0
      }
    }}}};
    this.send(JSON.stringify(msg));
  }

  public playback(item: CategoryItem | MediaItem): void {
    if (!this.rcSessionId) { console.warn('[WebsocketService] No rcSessionId for playback'); return; }
    const msg = { Device: { MediaPlayerNeXt: { RequestAction: {
      RcSessionId: this.rcSessionId, MsgId: uuidv1(), PlayerId: environment.playerId, ActionId: 'LoadSource',
      ActionIdOptions: {
        ProfileKey: environment.profileKey,
        ProviderKey: item.providerKey || (item as any).ProviderKey,
        AudioSourceUrl: "",
        AutoPlay: true, SignedData: item.signedData
      }
    }}}};
    this.send(JSON.stringify(msg));
  }

  public playbackAction(action: string): void {
    if (!this.rcSessionId) { console.warn('[WebsocketService] No rcSessionId for playbackAction'); return; }
    const msg = { Device: { MediaPlayerNeXt: { RequestAction: {
      RcSessionId: this.rcSessionId, MsgId: uuidv1(), PlayerId: environment.playerId,
      ActionId: action, ActionIdOptions: {}
    }}}};
    this.send(JSON.stringify(msg));
  }

  public selectBackCategory(): boolean {
    if (this.categoryHistoryStack.length > 0) {
      const previousMsg = this.categoryHistoryStack.pop();
      if (previousMsg) {
        this.send(JSON.stringify(previousMsg));
        this.currentCategoryRequestMessage = previousMsg;
        return true;
      }
    }
    return false;
  }

  public get canNavigateBackInCategory(): boolean {
    return this.categoryHistoryStack.length > 0;
  }

  public processResponse(response: any): void {
    // console.log('[WebsocketService] Full response received for processing:', JSON.stringify(response)); // Kept

    // Client Registration & Subscription
    if (response?.Device?.SubscriptionMgr?.WsConnectionsList?.Ws01?.RegisteredClientList) {
      const clientList = response.Device.SubscriptionMgr.WsConnectionsList.Ws01.RegisteredClientList;
      const firstRcSessionId = Object.keys(clientList)[0];
      if (firstRcSessionId && this.rcSessionId !== firstRcSessionId) {
        this.rcSessionId = firstRcSessionId;
        this.subscribeToCoreObjects(); // Renamed
        this.requestCurrentPlayerStatus();
      } else if (firstRcSessionId && this.rcSessionId === firstRcSessionId) {
        if (!this.mediaPlayerState.nowPlayingData && !this.mediaPlayerState.elapsedSec) { // More specific check
             this.requestCurrentPlayerStatus();
        }
      } else if (!firstRcSessionId) {
          console.error('[WebsocketService] RegisteredClientList found but no RcSessionId keys.'); // Kept
      }
    }
    // This secondary check might be redundant if the above is robust for all registration scenarios
    // if (response?.Device?.SubscriptionMgr?.RegisteredClientList && !this.rcSessionId) {
    //     console.warn("[WebsocketService] Subscription confirmed, but rcSessionId might have been missed."); // Kept
    //     if (this.rcSessionId) this.requestCurrentPlayerStatus();
    // }


    // Profiles
    if (response?.Device?.StreamingServices?.UserProfiles) {
      this.profiles = [];
      for (const idProfile in response.Device.StreamingServices.UserProfiles) {
        const profileData = response.Device.StreamingServices.UserProfiles[idProfile];
        const profile: Profile = { idProfile, name: profileData?.Name, providers: [] };
        if (profileData?.AssignedProviders) {
          for (const idService in profileData.AssignedProviders) {
            profile.providers?.push({ idService, name: profileData.AssignedProviders[idService]?.Name });
          }
        }
        this.profiles.push(profile);
      }
      this.reportUIMessageData({ profiles: this.profiles, type: 'profiles' });
    }

    // Categories (ProviderBrowseMenu)
    const providerBrowseMenuUpdate = response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.ProviderBrowseMenu;
    if (providerBrowseMenuUpdate) {
      this.categories = [];
      const menuDataItems = providerBrowseMenuUpdate.Categories?.Item01?.MenuDataItems;
      if (menuDataItems && Array.isArray(menuDataItems)) {
        for (const itemData of menuDataItems) {
          if (!itemData) continue;
          this.categories.push({
            idCategorie: itemData.BrowseKey || `cat_${Math.random().toString(36).substr(2, 9)}`,
            browseItemName: itemData.BrowseItemName || 'Unknown Category',
            signedData: itemData.SignedData !== undefined ? itemData.SignedData : null,
            urlIcon: itemData.UrlIcon,
            browseKey: itemData.BrowseKey || '',
            providerKey: itemData.MediaTypeMetaData?.ProviderKey,
            streamingMediaType: itemData.StreamingMediaType || 'unknown',
            artistName: itemData.MediaTypeMetaData?.ArtistName,
            albumName: itemData.MediaTypeMetaData?.AlbumName
          });
        }
      } // Assuming MenuDataItems is always an array if present for browse results

      const parentBrowseItemName = providerBrowseMenuUpdate.ParentBrowseKey?.BrowseItemName;
      this.lastProcessedCategories = [...this.categories];
      this.lastProcessedParentCategoryName = parentBrowseItemName;
      this.reportUIMessageData({ categories: this.categories, parentCategoryName: parentBrowseItemName, type: 'categories' });
    }

    // Search Results (SearchMenu)
    // Assuming Search Menu items are also in an array under MenuDataItems
    const searchMenuDataItems = response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu?.Categories?.Item01?.MenuDataItems;
    if (searchMenuDataItems && Array.isArray(searchMenuDataItems)) {
      const searchResults: CategoryItem[] = [];
      for (const itemData of searchMenuDataItems) {
        if (!itemData) continue;
        const resultItem: CategoryItem = {
          idCategorie: itemData.BrowseKey || `search_${Math.random().toString(36).substr(2, 9)}`,
          browseItemName: itemData.BrowseItemName || 'Unknown Item',
          signedData: itemData.SignedData !== undefined ? itemData.SignedData : null,
          urlIcon: itemData.UrlIcon,
          browseKey: itemData.BrowseKey || '',
          providerKey: itemData.MediaTypeMetaData?.ProviderKey,
          streamingMediaType: itemData.StreamingMediaType || 'unknown',
          artistName: itemData.MediaTypeMetaData?.ArtistName,
          albumName: itemData.MediaTypeMetaData?.AlbumName
        };
        if (!itemData.BrowseKey) console.warn('[WebsocketService] Search result item missing BrowseKey:', itemData); // Kept
        searchResults.push(resultItem);
      }
      this.reportUIMessageData({ searchResults: searchResults, type: 'searchResults' });
    } else if (response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu) {
      // This handles if SearchMenu object exists but MenuDataItems is empty or not an array
      console.warn('[WebsocketService] SearchMenu results MenuDataItems not found or not an array.'); // Kept
      this.reportUIMessageData({ searchResults: [], type: 'searchResults' });
    }

    // MediaPlayerNeXt State (NowPlayingData, AvailableActions, ElapsedSec)
    const playerNode = response?.Device?.MediaPlayerNeXt?.Players?.[environment.playerId];
    if (playerNode) {
      let playerStateChanged = false;

      if (playerNode.AvailableActions !== undefined) {
        this.mediaPlayerState.availableActions = playerNode.AvailableActions; // Already corrected to array if was object
        playerStateChanged = true;
      }

      const nowPlayingDataPath = playerNode.Player?.NowPlayingData;
      if (nowPlayingDataPath) {
        if (nowPlayingDataPath.TrackTitle && String(nowPlayingDataPath.TrackTitle).trim() !== '') {
          const newNowPlaying: NowPlayingData = {
            idnowPlaying: 'current', trackTitle: String(nowPlayingDataPath.TrackTitle),
            artistName: String(nowPlayingDataPath.ArtistName || ''), albumName: String(nowPlayingDataPath.AlbumName || ''),
            stationName: String(nowPlayingDataPath.StationName || ''), albumArtUrl: String(nowPlayingDataPath.AlbumArtUrl || ''),
            trackNum: Number(nowPlayingDataPath.TrackNum || 0), trackCnt: Number(nowPlayingDataPath.TrackCnt || 0),
            duration: String(nowPlayingDataPath.Duration || '0')
          };
          this.mediaPlayerState.nowPlayingData = newNowPlaying;
          if (nowPlayingDataPath.hasOwnProperty('ElapsedSec')) {
            this.mediaPlayerState.elapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
          }
          playerStateChanged = true;
        } else {
          if (nowPlayingDataPath.hasOwnProperty('ElapsedSec') && this.mediaPlayerState.nowPlayingData?.trackTitle) {
            const newElapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
            if (this.mediaPlayerState.elapsedSec !== newElapsedSec) {
              this.mediaPlayerState.elapsedSec = newElapsedSec;
              playerStateChanged = true;
            }
          }
           console.warn('[WebsocketService] Received NowPlayingData without valid TrackTitle. Partial update for ElapsedSec might have occurred if track was already playing.'); // Kept
        }
      } else if (playerNode.Player?.hasOwnProperty('ElapsedSec')) {
        const newElapsedSecVal = String(playerNode.Player.ElapsedSec || '0');
        if (this.mediaPlayerState.nowPlayingData) {
            if (this.mediaPlayerState.elapsedSec !== newElapsedSecVal) {
                this.mediaPlayerState.elapsedSec = newElapsedSecVal;
                playerStateChanged = true;
            }
        } else {
            if (this.mediaPlayerState.elapsedSec !== '0' || newElapsedSecVal !== '0') { // Avoid if already "0" and new is "0"
                this.mediaPlayerState.elapsedSec = newElapsedSecVal; // Store it even if no track, might be "0"
                playerStateChanged = true;
            }
        }
         // If NowPlayingData becomes null (playback stopped), clear it
        if (nowPlayingDataPath === null && this.mediaPlayerState.nowPlayingData) {
            this.mediaPlayerState.nowPlayingData = undefined;
            playerStateChanged = true;
        }
      }

      if (playerStateChanged) {
        this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
      }
    }

    // Notifications
    if (response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.Notification?.Widget?.Msg) {
      this.reportUIMessageData({ msgNotification: response.Device.MediaNavigation.RegisteredClientMenus[this.rcSessionId].Notification.Widget.Msg, type: 'notification' });
    }
  }
}
```
This version incorporates the requested log removals and applies the structural changes from the original prompt for this subtask.
Key changes in this version:
-   Initial `UIMessageDataSource` value to `{}`.
-   `connect()`: WebSocket already connected/connecting check. `onmessage` removes redundant logging of `event.data`. `onopen` logs and reports `connected:true` with a type. `onclose` resets `rcSessionId` and reports `connected:false` with a type.
-   `send()`: Added check for WebSocket readiness.
-   `reportUIMessageData()`: Private now.
-   `subscribeToCoreObjects()`: Renamed from `suscribe` and added `rcSessionId` check.
-   `requestCurrentPlayerStatus()`: Added `rcSessionId` check.
-   `streamingProviders()`, `browseProvider()`, `browseCategorie()`, `searchMedia()`, `playback()`, `playbackAction()`: Added `rcSessionId` checks where appropriate.
-   `processResponse()`:
    -   More robust `rcSessionId` handling to avoid re-subscribe loops and attempt player status on reconnects.
    -   Simplified profile provider mapping.
    -   Assumes `MenuDataItems` for browse categories is an array if present.
    -   Assumes `MenuDataItems` for search results is an array if present.
    -   More unified handling of `MediaPlayerNeXt` data under `playerNode`.
    -   Handles `ElapsedSec` potentially arriving when `NowPlayingData` is null (e.g., after stop).
    -   Clears `nowPlayingData` if explicitly set to `null` in response.
    -   Adds `type` field to more `reportUIMessageData` calls.
