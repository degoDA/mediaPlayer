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
      if (data && data.mediaPlayerState) {
        this.mediaPlayerState = data.mediaPlayerState;
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
   * Converts a time string (MM:SS or SS) to seconds.
   */
  private timeToSeconds(timeStr: string | number | undefined): number {
    if (timeStr === undefined) return 0;
    if (typeof timeStr === 'number') return timeStr; // Already seconds

    const parts = String(timeStr).split(':');
    let seconds = 0;
    if (parts.length === 2) { // MM:SS
      seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } else if (parts.length === 1) { // SS
      seconds = parseInt(parts[0], 10);
    }
    return isNaN(seconds) ? 0 : seconds;
  }

  calculateProgress(): void {
    if (this.mediaPlayerState?.nowPlayingData?.duration && this.mediaPlayerState?.elapsedSec !== undefined) {
      const totalDurationSeconds = this.timeToSeconds(this.mediaPlayerState.nowPlayingData.duration);
      const elapsedSeconds = this.timeToSeconds(this.mediaPlayerState.elapsedSec);

      if (totalDurationSeconds > 0) {
        this.playbackProgress = (elapsedSeconds / totalDurationSeconds) * 100;
      } else {
        this.playbackProgress = 0;
      }
    } else {
      this.playbackProgress = 0;
    }
  }

  sendPlaybackAction(action: string): void {
    console.log('[PlayerComponent] sendPlaybackAction called with action:', action); // ADD THIS LOG
    // Using the existing isActionAvailable helper which checks this.mediaPlayerState.availableActions
    if (this.isActionAvailable(action)) {
      this.websocketService.playbackAction(action);
    } else {
      // Updated warning to match the spirit of the prompt's example
      console.warn(`[PlayerComponent] Action ${action} is not available or button should be disabled.`);
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
    if (!this.nowPlayingData?.duration) return '0:00';
    if (typeof this.nowPlayingData.duration === 'number') {
        const minutes = Math.floor(this.nowPlayingData.duration / 60);
        const seconds = this.nowPlayingData.duration % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    return this.nowPlayingData.duration; // Assume it's already formatted if string
  }

  get elapsedSecFormatted(): string {
    if (this.mediaPlayerState?.elapsedSec === undefined) return '0:00';
    const elapsed = this.timeToSeconds(this.mediaPlayerState.elapsedSec);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Helper to check action availability for buttons
  isActionAvailable(action: string): boolean {
    console.log(`[PlayerComponent] isActionAvailable called for action: "${action}"`);
    console.log('[PlayerComponent] Current mediaPlayerState.availableActions:', this.mediaPlayerState?.availableActions);

    if (!this.mediaPlayerState?.availableActions) {
      console.log('[PlayerComponent] availableActions is undefined or null, typically meaning all actions are disabled or state is unknown.');
      // If availableActions is not defined, it's safer to assume actions are not available,
      // unless 'PlayPause' has special handling when a track is loaded but no actions specified.
      // However, the template uses this to *disable* buttons, so returning false makes them disabled.
      // The original logic was `return true` (optimistically enable).
      // Let's stick to disabling if unknown, except for perhaps a very specific PlayPause.
      // For now, if no availableActions, assume no actions are available from backend.
      return false;
    }

    // Specific handling for 'PlayPause' as it's a common UI toggle
    // that might map to 'Play' or 'Pause' actions from the backend.
    if (action === 'PlayPause') {
       const canPlay = this.mediaPlayerState.availableActions.hasOwnProperty('Play') && (this.mediaPlayerState.availableActions as any)['Play'] === true;
       const canPause = this.mediaPlayerState.availableActions.hasOwnProperty('Pause') && (this.mediaPlayerState.availableActions as any)['Pause'] === true;
       console.log(`[PlayerComponent] For PlayPause: has 'Play' action = ${canPlay}, has 'Pause' action = ${canPause}`);
       // The PlayPause button is enabled if either 'Play' or 'Pause' action is available.
       // The actual icon/text on the button might change based on current player state (e.g. isPlaying),
       // but this method just determines if the button itself is interactive.
       return canPlay || canPause;
    }

    // For other actions like Next, Previous, Shuffle, Repeat
    const hasAction = this.mediaPlayerState.availableActions.hasOwnProperty(action);
    const isActionTrue = hasAction && (this.mediaPlayerState.availableActions as any)[action] === true;

    console.log(`[PlayerComponent] mediaPlayerState.availableActions.hasOwnProperty("${action}"):`, hasAction);
    if(hasAction) {
      console.log(`[PlayerComponent] Value of action "${action}":`, (this.mediaPlayerState.availableActions as any)[action]);
    }
    // Action is available if the key exists AND its value is true.
    // Or if the key exists and it's not explicitly false (some backends might just list available actions without true/false)
    // For this implementation, we assume if key exists, it implies availability (true), unless it's explicitly false.
    // The prompt for PlaybackAction interface suggested boolean flags, so `=== true` is safer.
    return isActionTrue;
  }
}
