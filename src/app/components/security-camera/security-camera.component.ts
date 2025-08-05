import { Component } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-security-camera',
  imports: [],
  templateUrl: './security-camera.component.html',
  styleUrl: './security-camera.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SecurityCameraComponent {

  printConsole(msg: string) {
    console.info(msg);
  }

}
