import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapbanFsComponent } from '../../mapban-ui/mapban-fs/mapban-fs.component';

@Component({
  selector: 'app-mapban-fs-testing',
  standalone: true,
  imports: [CommonModule, MapbanFsComponent],
  template: `
    <div class="testing-container">
      <div class="controls">
        <h2>Mapban FS Testing</h2>
        <div class="scenario-buttons">
          <button (click)="loadBO3Scenario()" class="btn btn-primary">Load BO3 Scenario</button>
          <button (click)="loadBO5Scenario()" class="btn btn-secondary">Load BO5 Scenario</button>
          <button (click)="loadInProgressScenario()" class="btn btn-success">Load In-Progress</button>
          <button (click)="resetData()" class="btn btn-danger">Reset</button>
        </div>
        <div class="info">
          <p><strong>Current Format:</strong> {{ currentFormat }}</p>
          <p><strong>Total Bans:</strong> {{ totalBans }}</p>
          <p><strong>Maps Processed:</strong> {{ mapsProcessed }}/{{ totalMaps }}</p>
        </div>
      </div>
      
      <app-mapban-fs [data]="sessionData"></app-mapban-fs>
    </div>
  `,
  styles: [`
    .testing-container {
      width: 100vw;
      height: 100vh;
      position: relative;
    }
    
    .controls {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.8);
      padding: 20px;
      border-radius: 8px;
      color: white;
      min-width: 300px;
    }
    
    .scenario-buttons {
      display: flex;
      gap: 10px;
      margin: 15px 0;
    }
    
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-success {
      background: #28a745;
      color: white;
    }
    
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    
    .btn:hover {
      opacity: 0.8;
    }
    
    .info {
      margin-top: 15px;
      font-size: 14px;
    }
    
    .info p {
      margin: 5px 0;
    }
  `]
})
export class MapbanFsTestingComponent implements OnInit {
  sessionData: any = null;
  currentFormat = 'None';
  totalBans = 0;
  mapsProcessed = 0;
  totalMaps = 7;

  ngOnInit() {
    console.log('🧪 MapbanFsTestingComponent initialized');
    this.loadBO3Scenario(); // Load a scenario by default for testing
  }

  loadBO3Scenario() {
    console.log('🎮 Loading BO3 Scenario for mapban-fs (COMPLETED SERIES)');
    
    this.sessionData = {
      sessionIdentifier: "test-bo3-fs-completed",
      organizationName: "VCT Champions Tour",
      teams: [
        { 
          name: "Sentinels", 
          tricode: "SEN", 
          url: "/assets/misc/icon.webp"
        },
        { 
          name: "Fnatic", 
          tricode: "FNC", 
          url: "/assets/misc/logo.webp"
        }
      ],
      format: "bo3",
      availableMaps: [],
      selectedMaps: [
        { 
          name: "Bind", 
          bannedBy: 0,
          leftScore: 11,
          rightScore: 13
        },          // Map 1 - SEN ban (FNC won 13-11)
        { 
          name: "Icebox", 
          bannedBy: 1,
          leftScore: 13,
          rightScore: 8
        },        // Map 2 - FNC ban (SEN won 13-8)
        { 
          name: "Ascent", 
          pickedBy: 0,
          leftScore: 13,
          rightScore: 7
        },        // Map 3 - SEN pick (SEN won 13-7)
        { 
          name: "Haven", 
          pickedBy: 1,
          leftScore: 6,
          rightScore: 13
        },         // Map 4 - FNC pick (FNC won 13-6)
        { 
          name: "Split", 
          bannedBy: 0,
          leftScore: 0,
          rightScore: 0
        },         // Map 5 - SEN ban (not played)
        { 
          name: "Sunset", 
          bannedBy: 1,
          leftScore: 0,
          rightScore: 0
        },        // Map 6 - FNC ban (not played)
        { 
          name: "Lotus", 
          pickedBy: undefined,
          leftScore: 0,
          rightScore: 0
        }, // Map 7 - Decider (SEN won 13-11, series winner)
      ],
      stage: "completed",
      actingTeamCode: "SEN",
      actingTeam: 0,
      seriesWinner: 0, // Sentinels won the series 2-1
      seriesScore: { left: 2, right: 1 }
    };

    this.currentFormat = 'BO3';
    this.totalBans = 4;
    this.mapsProcessed = 7;
    
    console.log('✅ BO3 COMPLETED scenario loaded - SEN won 2-1:', this.sessionData);
  }

  loadBO5Scenario() {
    console.log('🎮 Loading BO5 Scenario for mapban-fs (COMPLETED SERIES)');
    
    this.sessionData = {
      sessionIdentifier: "test-bo5-fs-completed",
      organizationName: "VCT Champions Tour",
      teams: [
        { 
          name: "Team Liquid", 
          tricode: "TL", 
          url: "/assets/misc/icon.webp"
        },
        { 
          name: "NAVI", 
          tricode: "NAVI", 
          url: "/assets/misc/logo.webp"
        }
      ],
      format: "bo5",
      availableMaps: [],
      selectedMaps: [
        { 
          name: "Bind", 
          bannedBy: 0,
          leftScore: 0,
          rightScore: 0
        },          // Map 1 - TL ban (not played)
        { 
          name: "Icebox", 
          bannedBy: 1,
          leftScore: 0,
          rightScore: 0
        },        // Map 2 - NAVI ban (not played)
        { 
          name: "Ascent", 
          pickedBy: 0,
          leftScore: 13,
          rightScore: 10
        },      // Map 3 - TL pick (TL won 13-10)
        { 
          name: "Haven", 
          pickedBy: 1,
          leftScore: 9,
          rightScore: 13
        },      // Map 4 - NAVI pick (NAVI won 13-9) 
        { 
          name: "Split", 
          pickedBy: 0,
          leftScore: 13,
          rightScore: 6
        },      // Map 5 - TL pick (TL won 13-6)
        { 
          name: "Sunset", 
          pickedBy: 1,
          leftScore: 11,
          rightScore: 13
        },     // Map 6 - NAVI pick (NAVI won 13-11)
        { 
          name: "Lotus", 
          pickedBy: undefined,
          leftScore: 0,
          rightScore: 0
        },     // Map 7 - Decider (not yet played, so pastMap7 = false)
      ],
      stage: "completed",
      actingTeamCode: "TL",
      actingTeam: 0,
      seriesWinner: 0, // Team Liquid won the series 3-1
      seriesScore: { left: 3, right: 1 }
    };

    this.currentFormat = 'BO5';
    this.totalBans = 2;
    this.mapsProcessed = 7;
    
    console.log('✅ BO5 COMPLETED scenario loaded - TL won 3-1:', this.sessionData);
  }

  loadInProgressScenario() {
    console.log('🎮 Loading In-Progress Scenario for mapban-fs');
    
    this.sessionData = {
      sessionIdentifier: "test-inprogress-fs",
      organizationName: "VCT Champions Tour",
      teams: [
        { 
          name: "Sentinels", 
          tricode: "SEN", 
          url: "/assets/misc/icon.webp"
        },
        { 
          name: "FaZe Clan", 
          tricode: "FAZE", 
          url: "/assets/misc/logo.webp"
        }
      ],
      format: "bo3",
      availableMaps: [
        { name: "Haven" }, { name: "Ascent" }, { name: "Lotus" }
      ],
      selectedMaps: [
        { 
          name: "Bind", 
          bannedBy: 0,
          leftScore: 0,
          rightScore: 0
        },          // Map 1 - SEN ban (not played)
        { 
          name: "Icebox", 
          bannedBy: 1,
          leftScore: 0,
          rightScore: 0
        },        // Map 2 - FZE ban (not played)
        { 
          name: "Split", 
          pickedBy: 0,
          leftScore: 13,
          rightScore: 11
        },       // Map 3 - SEN pick (SEN won 13-11)
        { 
          name: "Sunset", 
          pickedBy: 1,
          leftScore: 8,
          rightScore: 13
        },      // Map 4 - FZE pick (FZE won 13-8) - tied 1-1
      ],
      stage: "pick",
      actingTeamCode: "SEN",
      actingTeam: 0
    };

    this.currentFormat = 'BO3';
    this.totalBans = 4;
    this.mapsProcessed = 4;
    
    console.log('✅ In-Progress BO3 scenario loaded - tied 1-1, need decider:', this.sessionData);
  }

  resetData() {
    console.log('🔄 Resetting mapban-fs data');
    
    this.sessionData = {
      sessionIdentifier: "test-reset-fs",
      organizationName: "VCT Champions Tour",
      teams: [
        { 
          name: "Team Alpha", 
          tricode: "ALPHA", 
          url: "/assets/misc/icon.webp"
        },
        { 
          name: "Team Beta", 
          tricode: "BETA", 
          url: "/assets/misc/logo.webp"
        }
      ],
      format: undefined,
      availableMaps: [
        { name: "Ascent" }, { name: "Bind" }, { name: "Haven" },
        { name: "Split" }, { name: "Lotus" }, { name: "Sunset" }, { name: "Icebox" }
      ],
      selectedMaps: [
        { name: "Ascent" }, { name: "Bind" }, { name: "Haven" },
        { name: "Split" }, { name: "Lotus" }, { name: "Sunset" }, { name: "Icebox" }
      ],
      stage: "ban",
      actingTeamCode: "ALPHA",
      actingTeam: 0
    };

    this.currentFormat = 'None';
    this.totalBans = 0;
    this.mapsProcessed = 0;
    
    console.log('✅ Data reset for mapban-fs with default maps');
  }
}
