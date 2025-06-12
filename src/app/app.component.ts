import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// FormsModule might not be needed anymore if AppComponent doesn't have forms
// import { FormsModule } from '@angular/forms';
// WebsocketService, environment, Profile are no longer used here
// import { WebsocketService } from './services/websocket.service';
// import { environment } from '../environments/environment.prod'; // Correct environment import will be handled by build
// import { Profile } from './interfaces/profile.interface';
import { MainPlayerViewComponent } from './components/main-player-view/main-player-view.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MainPlayerViewComponent], // FormsModule removed unless needed
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  // All previous properties and methods are removed as their responsibilities
  // have been moved to MainPlayerViewComponent and its children.

  constructor() {
    // WebsocketService connection is now handled by MainPlayerViewComponent
  }

  ngOnInit(): void {
    // Initialization logic previously here is now in MainPlayerViewComponent
  }

  // All other methods (send, selectSreaming, etc.) are removed.
}
