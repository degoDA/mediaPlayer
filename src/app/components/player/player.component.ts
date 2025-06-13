import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { MediaPlayerState, NowPlayingData, PlaybackAction } from '../../interfaces/player.interface';

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
  playbackProgress: number = 0;

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.mediaPlayerState) {
        this.mediaPlayerState = data.mediaPlayerState;
        // console.log('[PlayerComponent] ngOnInit - mediaPlayerState received. Calling calculateProgress. State:', JSON.stringify(this.mediaPlayerState)); // Removed
        this.calculateProgress();
    }
    });
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  /**
   * Converts a time string (MM:SS or SS) or a number to seconds.
   */
  private timeToSeconds(timeStr: string | number | undefined): number {
    if (timeStr === undefined || timeStr === null) {
      return 0;
    }
    if (typeof timeStr === 'number') {
      return isNaN(timeStr) ? 0 : timeStr;
    }
    // It's a string
    if (String(timeStr).includes(':')) {
      const parts = String(timeStr).split(':');
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return (minutes * 60) + seconds;
      }
      return 0;
    }
    const numSeconds = parseInt(String(timeStr), 10);
    return isNaN(numSeconds) ? 0 : numSeconds;
  }

  private formatTimeDisplay(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return '00:00';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  calculateProgress(): void {
    // console.log('[PlayerComponent] calculateProgress CALLED. Current Duration:', this.mediaPlayerState?.nowPlayingData?.duration, 'Current ElapsedSec:', this.mediaPlayerState?.elapsedSec); // Removed
    if (this.mediaPlayerState?.nowPlayingData?.duration && this.mediaPlayerState?.elapsedSec !== undefined) {
      const totalDurationSeconds = this.timeToSeconds(this.mediaPlayerState.nowPlayingData.duration);
      const elapsedSecondsNum = this.timeToSeconds(this.mediaPlayerState.elapsedSec);
      // console.log('[PlayerComponent] Parsed values - totalDurationSeconds:', totalDurationSeconds, 'elapsedSecondsNum:', elapsedSecondsNum); // Removed

      if (totalDurationSeconds > 0) {
        const progressPercentage = (elapsedSecondsNum / totalDurationSeconds) * 100;
        // console.log('[PlayerComponent] Calculated progress value (before assignment):', progressPercentage); // Removed
        this.playbackProgress = progressPercentage;
      } else {
        this.playbackProgress = 0;
      }
    } else {
      this.playbackProgress = 0;
    }
    // console.log('[PlayerComponent] playbackProgress property updated to:', this.playbackProgress); // Removed
  }

  sendPlaybackAction(uiAction: string): void {
    // console.log('[PlayerComponent] sendPlaybackAction called with uiAction:', uiAction); // Removed

    if (!this.isActionAvailable(uiAction)) {
      console.warn(`[PlayerComponent] UI Action "${uiAction}" is not currently available based on backend state.`); // Kept this warn
      return;
    }

    let backendAction: string | null = null;

    switch (uiAction) {
      case 'PlayPause':
        if (this.mediaPlayerState?.availableActions?.includes('Pause')) {
          backendAction = 'Pause';
        } else if (this.mediaPlayerState?.availableActions?.includes('Play')) {
          backendAction = 'Play';
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
        // console.error(`[PlayerComponent] Unknown uiAction "${uiAction}" in sendPlaybackAction.`); // Removed
        // It's better to not send an action if it's unknown, or have a defined behavior.
        // For now, backendAction will remain null and the warning below will trigger.
        break;
    }

    if (backendAction) {
      // console.log(`[PlayerComponent] Mapped uiAction "${uiAction}" to backendAction "${backendAction}"`); // Removed
      this.websocketService.playbackAction(backendAction);
    } else {
      // This warning is useful if isActionAvailable was true but no mapping was found (e.g. PlayPause logic issue)
      console.warn(`[PlayerComponent] No backendAction determined for uiAction "${uiAction}".`);
    }
  }

  // Helper Getters for easier template access
  get nowPlayingData(): NowPlayingData | undefined {
    return this.mediaPlayerState?.nowPlayingData;
  }

  get albumArtUrl(): string | undefined {
    return this.nowPlayingData?.albumArtUrl || 'assets/default-album-art.png'; // Fallback image
  }

  get trackTitle(): string {
    return this.nowPlayingData?.trackTitle || 'No Title';
  }

  get artistName(): string {
    return this.nowPlayingData?.artistName || 'Unknown Artist';
  }

  get albumName(): string {
    return this.nowPlayingData?.albumName || 'Unknown Album';
  }

  get totalDurationFormatted(): string {
    const durationNum = this.timeToSeconds(this.mediaPlayerState?.nowPlayingData?.duration);
    return this.formatTimeDisplay(durationNum);
  }

  get elapsedSecFormatted(): string {
    const elapsedNum = this.timeToSeconds(this.mediaPlayerState?.elapsedSec);
    return this.formatTimeDisplay(elapsedNum);
  }

  get isCurrentlyPausable(): boolean {
    return this.mediaPlayerState?.availableActions?.includes('Pause') || false;
  }

  // Optional: isCurrentlyPlayable, if backend sends 'Play' when paused
  // get isCurrentlyPlayable(): boolean {
  //   return this.mediaPlayerState?.availableActions?.includes('Play') || false;
  // }

  isActionAvailable(uiAction: string): boolean {
    // This method should be clean of verbose logs as per previous cleanup.
    // The only remaining log is for the 'PlayPause' case as specifically requested.
    const backendActions = Array.isArray(this.mediaPlayerState?.availableActions)
      ? this.mediaPlayerState.availableActions
      : [];

    if (!this.mediaPlayerState || (backendActions.length === 0 && uiAction !== 'PlayPause')) {
        if (uiAction === 'PlayPause' && this.mediaPlayerState?.nowPlayingData) {
          // Allow PlayPause check to proceed
        } else {
            return false;
        }
    }

    switch (uiAction) {
      case 'PlayPause':
        const canPlay = backendActions.includes('Play');
        const canPause = backendActions.includes('Pause');
        // console.log(`[PlayerComponent] For PlayPause: backend has 'Play'=${canPlay}, backend has 'Pause'=${canPause}`); // This was re-added in error in last step, removing again.
        return (this.mediaPlayerState?.nowPlayingData && (canPlay || canPause)) || false;
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
