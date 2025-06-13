import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common'; // For *ngIf, etc.

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush // Good for simple display components
})
export class NotificationComponent {
  @Input() message: string = '';
  // Optional: Output for manual dismissal
  // @Output() dismissed = new EventEmitter<void>();

  // onDismiss(): void {
  //   this.dismissed.emit();
  // }
}
