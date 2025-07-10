import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { MediaPlayerState, NowPlayingData } from '../../interfaces/player.interface';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnInit, OnDestroy {
  mediaPlayerState?: MediaPlayerState;
  private uiSubscription!: Subscription;

  @Output() requestFullScreenPlayer = new EventEmitter<void>();

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.mediaPlayerState) {
        this.handlePlaybackStateChange(data.mediaPlayerState as MediaPlayerState);
    }
    });
  }

  ngOnDestroy(): void {
    // this.stopLocalProgressTimer(); // Method removed
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }


  private handlePlaybackStateChange(newState: MediaPlayerState): void {
    this.mediaPlayerState = newState;
  }

  public onExpandClicked(): void {
    this.requestFullScreenPlayer.emit();
  }

  sendPlaybackAction(uiAction: string): void {
    if (!this.isActionAvailable(uiAction)) {
      console.warn(`[PlayerComponent] UI Action "${uiAction}" is not currently available based on backend state.`);
      return;
    }

    let backendAction: string | null = null;

    switch (uiAction) {
      case 'PlayPause':
        if (this.mediaPlayerState?.availableActions?.includes('Pause')) {
            backendAction = 'Pause';
        } else if (this.mediaPlayerState?.availableActions?.includes('Play')) {
            backendAction = 'Play';
        } else if (this.mediaPlayerState?.nowPlayingData) {
            backendAction = 'Play'; // Fallback if actions empty but track exists
        }
        break;
      case 'Next':
        backendAction = 'NextTrack';
        break;
      case 'Previous':
        backendAction = 'PreviousTrack';
        break;
      case 'Shuffle':
        backendAction = 'Shuffle';
        break;
      case 'Repeat':
        backendAction = 'Repeat';
        break;
      default:
        break;
    }

    if (backendAction) {
      this.websocketService.playbackAction(backendAction);
    } else {
      console.warn(`[PlayerComponent] No backendAction determined for uiAction "${uiAction}".`);
    }
  }

  // Helper Getters for easier template access
  get nowPlayingData(): NowPlayingData | undefined {
    return this.mediaPlayerState?.nowPlayingData;
  }

  // albumArtUrl getter removed
  // albumName getter removed
  // stationName getter removed
  // totalDurationFormatted getter removed

  get trackTitle(): string | undefined {
    return this.nowPlayingData?.trackTitle;
  }

  get artistName(): string | undefined {
    return this.nowPlayingData?.artistName;
  }

  get isCurrentlyPausable(): boolean {
    return this.mediaPlayerState?.availableActions?.includes('Pause') || false;
  }

  isActionAvailable(uiAction: string): boolean {
    const backendActions = Array.isArray(this.mediaPlayerState?.availableActions)
      ? this.mediaPlayerState.availableActions
      : [];

    if (!this.mediaPlayerState || (backendActions.length === 0 && uiAction !== 'PlayPause')) {
        if (uiAction === 'PlayPause' && this.mediaPlayerState?.nowPlayingData) {
          // Allow PlayPause check to proceed if track is loaded and actions might appear
        } else {
            return false;
        }
    }

    switch (uiAction) {
      case 'PlayPause':
        // If a track is loaded, PlayPause button is generally enabled.
        // Backend will decide if 'Play' or 'Pause' is the actual action based on its state.
        // Or, more strictly, enable if 'Play' or 'Pause' is explicitly available.
        return !!this.mediaPlayerState?.nowPlayingData &&
               (backendActions.includes('Play') || backendActions.includes('Pause') || backendActions.length === 0);
      case 'Next':
        return backendActions.includes('NextTrack');
      case 'Previous':
        return backendActions.includes('PreviousTrack');
      case 'Shuffle':
        return backendActions.includes('Shuffle');
      case 'Repeat':
        return backendActions.includes('Repeat');
      default:
        return false;
    }
  }
}
