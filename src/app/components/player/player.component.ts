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
    // Check if the action is available, if availableActions is populated
    if (this.mediaPlayerState?.availableActions && this.mediaPlayerState.availableActions.hasOwnProperty(action)) {
      if ((this.mediaPlayerState.availableActions as any)[action]) { // Type assertion
        this.websocketService.playbackAction(action);
      } else {
        console.warn(`Action ${action} is not available.`);
      }
    } else if (!this.mediaPlayerState?.availableActions) {
      // If availableActions is not yet populated, send the action optimistically.
      // Or, you could disable buttons until availableActions is known.
      this.websocketService.playbackAction(action);
    } else {
       console.warn(`Action ${action} is not listed in availableActions.`);
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
    if (!this.mediaPlayerState?.availableActions) return true; // Optimistically enable if not known
    return (this.mediaPlayerState.availableActions as any)[action] === true;
  }
}
