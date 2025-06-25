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
  // public backCategory: any = {}; // Removed
  private categoryHistoryStack: any[] = [];
  private currentCategoryRequestMessage: any = null;

  connect(url: string, protocol: string): void {
    this.socket = new WebSocket(url, protocol);

    this.socket.onmessage = (event) => {
      console.log('[WebsocketService] Raw WebSocket message received:', event.data);
      const rawData = event.data as string;

      // Attempt to split if "}{" is found, indicating potential concatenation.
      // This regex looks for "}" followed by optional whitespace then "{".
      const messageParts = rawData.replace(/}\s*{/g, '}\n{').split('\n');

      for (const part of messageParts) {
        if (part.trim() === '') {
          continue;
        }
        try {
          const parsedResponse = JSON.parse(part);
          console.log('[WebsocketService] Processing parsed message part:', parsedResponse);

          // Check and correct AvailableActions if it's an object instead of an array
          const actionsPath = parsedResponse?.Device?.MediaPlayerNeXt?.Players?.Player01?.AvailableActions;
          if (actionsPath && typeof actionsPath === 'object' && !Array.isArray(actionsPath)) {
            console.warn('[WebsocketService] Received AvailableActions as an object, converting to empty array. Original:', actionsPath);
            // Ensure path to AvailableActions exists before assignment
            if (parsedResponse.Device && parsedResponse.Device.MediaPlayerNeXt && parsedResponse.Device.MediaPlayerNeXt.Players && parsedResponse.Device.MediaPlayerNeXt.Players.Player01) {
                parsedResponse.Device.MediaPlayerNeXt.Players.Player01.AvailableActions = [];
            }
          }

          this.processResponse(parsedResponse);
          this.messages$.next(parsedResponse); // Consider if this should be the original `part` on error, or structured error.

        } catch (e) {
          console.error('[WebsocketService] Error parsing JSON message part. Part:', part, 'Error:', e);
          // Optionally, you could emit an error on messages$ or handle differently
          // this.messages$.error(new Error(`Failed to parse message part: ${part}`));
        }
      }
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
    // this.saveCategory(msg) // Removed
    this.categoryHistoryStack = []; // Clear history for new provider
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(msg)); // Store a copy
  }

  browseCategorie(categoryToEnter: CategoryItem){ // Renamed param for clarity
    // Before sending the new message, save the current request message (which led to this list)
    if (this.currentCategoryRequestMessage) {
      this.categoryHistoryStack.push(JSON.parse(JSON.stringify(this.currentCategoryRequestMessage))); // Store a copy
    }

    const newMsg = { // Renamed to newMsg for clarity
      "Device": {
        "MediaNavigation": {
          "RequestAction": {
            "RcSessionId": this.rcSessionId,
            "MsgId": uuidv1(),
            "ProfileKey": environment.profileKey,
            "MenuCategory": "ProviderBrowseMenu",
            "MenuCategoryOptions": {
              "ProviderKey": categoryToEnter.providerKey,
              "BrowseKey": categoryToEnter.browseKey,
              "ItemCount": 50,
              "ItemOffset": 0,
              "SignedData": categoryToEnter.signedData
            }
          }
        }
      }
    };
    this.send(JSON.stringify(newMsg));
    this.currentCategoryRequestMessage = JSON.parse(JSON.stringify(newMsg)); // Update current request
    // Old call to saveCategory(category) removed
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
    // console.log('[WebsocketService] playbackAction called with action:', action); // Removed
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
    };
    // console.log('[WebsocketService] Sending playback action message:', JSON.stringify(msg)); // Removed
    this.send(JSON.stringify(msg));
  }

  selectBackCategory(): boolean {
    if (this.categoryHistoryStack.length > 0) {
      const previousCategoryRequestMessage = this.categoryHistoryStack.pop();
      if (previousCategoryRequestMessage) {
        this.send(JSON.stringify(previousCategoryRequestMessage));
        // When we go back, the message we just sent becomes the new "current"
        this.currentCategoryRequestMessage = previousCategoryRequestMessage;
        return true; // Successfully went back
      }
    }
    // If stack becomes empty or was empty, potentially clear current or set to a root/home state
    // For now, if stack is empty, there's no "current" defined by back action.
    // Consider if currentCategoryRequestMessage should be set to null if stack is empty.
    // Depending on desired behavior, might need to fetch a default/home screen if stack is empty.
    // this.currentCategoryRequestMessage = null; // Optional: clear if stack empty
    return false; // Cannot go back further
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
        // Assuming the response data is already a string[] or compatible.
        // MediaPlayerState.availableActions is now string[] | undefined.
        this.mediaPlayerState.availableActions = response.Device.MediaPlayerNeXt.Players.Player01.AvailableActions;
        this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } }); // Spread to help change detection
      }

      // --- Start of Refactored NowPlayingData Block ---
      const nowPlayingDataPath = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData;

      if (nowPlayingDataPath) { // Check if the NowPlayingData object itself exists
        // Check for a valid TrackTitle before processing this NowPlayingData update
        if (nowPlayingDataPath.TrackTitle && String(nowPlayingDataPath.TrackTitle).trim() !== '') {

          const newNowPlaying: NowPlayingData = {
            idnowPlaying: 'current', // Or generate/use a proper ID if available from nowPlayingDataPath.idnowPlaying
            trackTitle: String(nowPlayingDataPath.TrackTitle),
            artistName: String(nowPlayingDataPath.ArtistName || ''),
            albumName: String(nowPlayingDataPath.AlbumName || ''),
            stationName: String(nowPlayingDataPath.StationName || ''),
            albumArtUrl: String(nowPlayingDataPath.AlbumArtUrl || ''),
            trackNum: Number(nowPlayingDataPath.TrackNum || 0),
            trackCnt: Number(nowPlayingDataPath.TrackCnt || 0),
            duration: String(nowPlayingDataPath.Duration || '0') // Keep as string, PlayerComponent handles conversion
          };

          this.mediaPlayerState.nowPlayingData = newNowPlaying;

          if (nowPlayingDataPath.hasOwnProperty('ElapsedSec')) {
               this.mediaPlayerState.elapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
          }

          // console.log('[WebsocketService] Valid NowPlayingData received, mediaPlayerState updated:', this.mediaPlayerState); // Removed
          this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });

        } else {
          console.warn('[WebsocketService] Received NowPlayingData without a valid TrackTitle. Player info will not be updated with this message. Data:', nowPlayingDataPath); // Kept
          // If only ElapsedSec came in this payload but TrackTitle was invalid, we might still want to process ElapsedSec.
          // This logic currently skips the entire payload if TrackTitle is invalid.
          // A separate check for ElapsedSec outside this if(nowPlayingDataPath.TrackTitle) block might be needed
          // if ElapsedSec can arrive in a NowPlayingData object that temporarily lacks a TrackTitle.
        }
      }
      // --- End of Refactored NowPlayingData Block ---

      // The separate block for ElapsedSec updates (if it comes as a distinct message part or different path)
      // This needs to be reviewed. If nowPlayingDataPath is the *only* source for ElapsedSec,
      // and it's handled above (iff TrackTitle is valid), then this block might be redundant or needs adjustment.
      // If an ElapsedSec update can come completely independently of a NowPlayingData object, this could be:
      const elapsedSecPath = response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.ElapsedSec; // Path just for ElapsedSec
      if (elapsedSecPath !== undefined && !nowPlayingDataPath) { // Only if not part of a NowPlayingData object processed above
        // This condition means we received a message that is *not* a full NowPlayingData object
        // but *does* contain an ElapsedSec update at the expected player path.
        // This is less common; usually ElapsedSec is part of NowPlayingData.
        // For safety, let's only update if there's already some nowPlayingData loaded.
        if (this.mediaPlayerState.nowPlayingData) {
            const newElapsedSec = String(elapsedSecPath || '0');
            if (this.mediaPlayerState.elapsedSec !== newElapsedSec) { // Check if changed
                this.mediaPlayerState.elapsedSec = newElapsedSec;
                // console.log('[WebsocketService] Independent ElapsedSec update:', this.mediaPlayerState.elapsedSec); // Removed
                this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
            }
        }
      }
      // However, the original code checked response?.Device?.MediaPlayerNeXt?.Players?.Player01?.Player?.NowPlayingData?.ElapsedSec
      // which implies ElapsedSec is a field *within* NowPlayingData.
      // The new logic already handles this if TrackTitle is valid.
      // If TrackTitle is *invalid* but ElapsedSec is present in nowPlayingDataPath, the current refactor *misses* that ElapsedSec.
      // Let's ensure an ElapsedSec within nowPlayingDataPath is processed even if TrackTitle is bad,
      // but only if nowPlayingData is already populated (so we're just updating time for an existing track).
      else if (nowPlayingDataPath && nowPlayingDataPath.hasOwnProperty('ElapsedSec') && (!nowPlayingDataPath.TrackTitle || String(nowPlayingDataPath.TrackTitle).trim() === '')) {
          // This case: NowPlayingData object exists, it has ElapsedSec, but TrackTitle is invalid.
          // We only update elapsedSec if there's already a track loaded.
          if (this.mediaPlayerState.nowPlayingData && this.mediaPlayerState.nowPlayingData.trackTitle) {
              const newElapsedSec = String(nowPlayingDataPath.ElapsedSec || '0');
              if (this.mediaPlayerState.elapsedSec !== newElapsedSec) { // Check if changed
                  this.mediaPlayerState.elapsedSec = newElapsedSec;
                  // console.log('[WebsocketService] ElapsedSec updated for existing track (TrackTitle in this message was invalid):', this.mediaPlayerState.elapsedSec); // Removed
                  this.reportUIMessageData({ mediaPlayerState: { ...this.mediaPlayerState } });
              }
          }
      }


      if (
        // Response playback actions
        response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg
      )
        this.reportUIMessageData({ msgNotification: response?.Device?.MediaNavigation?.RegisteredClientMenus[this.rcSessionId]?.Notification?.Widget?.Msg });

      // Check for SearchMenu results
      const searchMenuDataItemsArray = response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu?.Categories?.Item01?.MenuDataItems;

      if (searchMenuDataItemsArray && Array.isArray(searchMenuDataItemsArray)) {
        const searchResults: CategoryItem[] = [];
        for (const itemData of searchMenuDataItemsArray) { // Changed from for...in to for...of
          if (!itemData) continue; // Skip if itemData itself is null/undefined in the array

          const resultItem: CategoryItem = {
            idCategorie: itemData.BrowseKey || `search_item_${Math.random().toString(36).substr(2, 9)}`, // Use BrowseKey or generate an ID
            browseItemName: itemData.BrowseItemName || 'Unknown Item',
            signedData: itemData.SignedData,
            urlIcon: itemData.UrlIcon,
            browseKey: itemData.BrowseKey,
            providerKey: itemData.MediaTypeMetaData?.ProviderKey,
            streamingMediaType: itemData.StreamingMediaType || 'unknown',
            artistName: itemData.MediaTypeMetaData?.ArtistName,
            albumName: itemData.MediaTypeMetaData?.AlbumName
          };
          searchResults.push(resultItem);
        }
        console.log('[WebsocketService] Processed SearchMenu results (from array):', searchResults);
        this.reportUIMessageData({ searchResults: searchResults, type: 'searchResults' });
      } else if (searchMenuDataItemsArray && typeof searchMenuDataItemsArray === 'object' && !Array.isArray(searchMenuDataItemsArray)) {
        // This block handles the case where MenuDataItems is an OBJECT of items, not an array
        // This was the previous assumption for browse/search results based on existing code.
        const searchResults: CategoryItem[] = [];
        for (const id in searchMenuDataItemsArray) { // Iterate object keys
            const itemData = searchMenuDataItemsArray[id];
            if (!itemData) continue;

            const resultItem: CategoryItem = {
                idCategorie: id, // Use the object key as ID
                browseItemName: itemData.BrowseItemName || 'Unknown Item',
                signedData: itemData.SignedData,
                urlIcon: itemData.UrlIcon,
                browseKey: itemData.BrowseKey,
                providerKey: itemData.MediaTypeMetaData?.ProviderKey,
                streamingMediaType: itemData.StreamingMediaType || 'unknown',
                artistName: itemData.MediaTypeMetaData?.ArtistName,
                albumName: itemData.MediaTypeMetaData?.AlbumName
            };
            searchResults.push(resultItem);
        }
        console.log('[WebsocketService] Processed SearchMenu results (from object):', searchResults);
        this.reportUIMessageData({ searchResults: searchResults, type: 'searchResults' });
      } else if (response?.Device?.MediaNavigation?.RegisteredClientMenus?.[this.rcSessionId]?.MenuUpdates?.SearchMenu) {
        // Handle case where SearchMenu path exists but MenuDataItems might be missing or not an array/object (e.g. no results)
        console.warn('[WebsocketService] SearchMenu results MenuDataItems not found or not a recognized structure. Response path existed.', response.Device.MediaNavigation.RegisteredClientMenus[this.rcSessionId].MenuUpdates.SearchMenu);
        this.reportUIMessageData({ searchResults: [], type: 'searchResults' }); // Emit empty results
      }
    }
  }

  // saveCategory method removed

  reportUIMessageData(data: any) {
    this.UIMessageDataSource.next(data);
  }

  public get canNavigateBackInCategory(): boolean {
    return this.categoryHistoryStack.length > 0;
  }

  // Add this new public method
  public searchMedia(
    searchQuery: string,
    // providerKey: string, // No longer needed if SearchProviderKey is "ALL"
    profileKey: string,
    // rcSessionId: string // rcSessionId is a class member, no need to pass
    searchCategory: string = 'song' // Default search category to 'song'
  ): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WebsocketService] WebSocket not connected. Cannot send search request.');
      return;
    }
    if (!this.rcSessionId) {
      console.warn('[WebsocketService] No rcSessionId. Cannot send search request.');
      return;
    }
    // profileKey is essential, using fallback to environment.profileKey if not provided.
    const resolvedProfileKey = profileKey || environment.profileKey;
    if (!resolvedProfileKey) {
      console.warn('[WebsocketService] No profileKey available (neither passed nor in environment). Cannot send search request.');
      return;
    }

    const msg = {
      Device: {
        MediaNavigation: {
          RequestAction: {
            RcSessionId: this.rcSessionId,
            MsgId: uuidv1(), // Ensure uuidv1 is imported
            ProfileKey: resolvedProfileKey,
            MenuCategory: 'SearchMenu',
            MenuCategoryOptions: {
              SearchProviderKey: 'ALL', // Search across all providers
              SearchText: searchQuery,
              SearchCategory: searchCategory, // e.g., "song", "artist", "album"
              ItemCount: 50, // Standard item count
              ItemOffset: 0
            }
          }
        }
      }
    };

    console.log('[WebsocketService] Sending search request:', JSON.stringify(msg));
    this.send(JSON.stringify(msg));
    // No changes to history stack or currentCategoryRequestMessage for search.
  }
}
