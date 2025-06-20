import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // For ngModel

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule], // Import FormsModule for ngModel
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.css']
})
export class SearchInputComponent {
  @Output() searchQuery = new EventEmitter<string>();
  currentSearchTerm: string = '';

  constructor() { }

  onSubmit(): void {
    if (this.currentSearchTerm && this.currentSearchTerm.trim() !== '') {
      this.searchQuery.emit(this.currentSearchTerm.trim());
    }
    // Optionally clear the input after submit:
    // this.currentSearchTerm = '';
  }
}
