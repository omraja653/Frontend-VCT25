import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { SessionMap, Stage } from "../../mapban-ui/mapban-ui.component";
import { RiveMapbanService, MapbanAssets, SponsorInfo, MapState, TeamInfo, SideSelection } from "../../services/rive-mapban.service";
import { Rive } from "@rive-app/canvas";

@Component({
  selector: "app-mapban-testing",
  standalone: true,
  template: `
    <div class="mapban-testing-container">
      <div class="controls">
        <div>
          <label>Stage:
            <select [(ngModel)]="stage">
              <option value="ban">Ban</option>
              <option value="pick">Pick</option>
              <option value="side">Side</option>
              <option value="decider">Decider</option>
            </select>
          </label>
        </div>
        <div>
          <label>Acting Team:
            <select [(ngModel)]="actingTeam">
              <option [value]="0">{{teams[0].tricode}} ({{teams[0].name}})</option>
              <option [value]="1">{{teams[1].tricode}} ({{teams[1].name}})</option>
            </select>
          </label>
        </div>
        <div class="maps">
          <label>Available Maps:</label>
          <select #mapSelect>
            <option *ngFor="let map of availableMaps" [value]="map.name">{{map.name}}</option>
          </select>
          <button (click)="banMap(mapSelect.value)">Ban</button>
          <button (click)="pickMap(mapSelect.value)">Pick</button>
        </div>
        
        <!-- Scenario Controls Section -->
        <div class="scenario-controls">
          <label>Test Scenarios:</label>
          <div class="scenario-buttons">
            <button (click)="loadFullBO3Scenario()">Full BO3</button>
            <button (click)="loadAllBansScenario()">All Bans</button>
            <button (click)="loadAllPicksScenario()">All Picks</button>
          </div>
        </div>
        
        <div class="sponsor-controls">
          <label>Sponsor Controls:</label>
          <button (click)="toggleSponsors()">
            {{mockMatch.tools.sponsorInfo.enabled ? 'Disable' : 'Enable'}} Sponsors
          </button>
          <button (click)="cycleSponsor()" [disabled]="!mockMatch.tools.sponsorInfo.enabled">
            Cycle Sponsor
          </button>
        </div>
        
        <!-- Color Controls Section -->
        <div class="color-controls">
          <label>Mapban Colors:</label>
          <div class="color-inputs">
            <div>
              <label>Primary Color:</label>
              <input type="color" #primaryColorInput value="#80152D" (change)="updateMapbanColors(primaryColorInput.value, secondaryColorInput.value)">
              <span>{{getHexDisplay(mapbanColors.primaryColor)}}</span>
            </div>
            <div>
              <label>Secondary Color:</label>
              <input type="color" #secondaryColorInput value="#1C8C74" (change)="updateMapbanColors(primaryColorInput.value, secondaryColorInput.value)">
              <span>{{getHexDisplay(mapbanColors.secondaryColor)}}</span>
            </div>
          </div>
          <button (click)="resetColors()">Reset Colors</button>
        </div>
        <button (click)="reset()">Reset</button>
        <button (click)="updateRiveAssets()">Update Animation</button>
        <button (click)="debugInputs()">Debug Inputs</button>
        <button (click)="testColors()">Test Colors</button>
        <button (click)="forceRefreshColors()">Force Refresh Colors</button>
      </div>
      <div class="rive-container">
        <canvas #riveCanvas></canvas>
      </div>
    </div>
  `,
  imports: [FormsModule, CommonModule],
  styleUrls: ["./mapban-testing.scss"]
})
export class MapbanTestingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('riveCanvas', { static: true }) riveCanvas!: ElementRef<HTMLCanvasElement>;
  
  stage: Stage = "ban";
  actingTeam: 0 | 1 = 0;
  availableMaps: SessionMap[] = this.getInitialMaps();
  selectedMaps: SessionMap[] = [];

  // Mock match data for testing
  mockMatch = {
    tools: {
      sponsorInfo: {
        enabled: true,
        sponsors: [
          '/assets/misc/logo.webp'
        ],
        duration: 3000
      }
    }
  };

  currentSponsorIndex = 0;

  // Team information for BO3 scenario
  teams: { [key: number]: TeamInfo } = {
    0: { tricode: 'SEN', name: 'Sentinels' },
    1: { tricode: 'FNC', name: 'Fnatic' }
  };

  // Map names for proper display (all capitals)
  private mapNames: { [key: string]: string } = {
    'Ascent': 'ASCENT',
    'Bind': 'BIND', 
    'Haven': 'HAVEN',
    'Split': 'SPLIT',
    'Lotus': 'LOTUS',
    'Sunset': 'SUNSET',
    'Icebox': 'ICEBOX'
  };

  // Animation state tracking for performance
  private animationState = {
    sponsorTriggered: false,
    picksTriggered: false,
    bansTriggered: false
  };

  private updateDebounceTimer?: number;

  // Add preloading state tracking
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private isPreloadingComplete = false;

  // Color configuration for data binding
  mapbanColors = {
    primaryColor: 0x80152D,    // Red/Attacking team color (hex: #80152D)
    secondaryColor: 0x1C8C74   // Green/Defending team color (hex: #1C8C74)
  };

  constructor(private riveService: RiveMapbanService) {
    this.initializeSelectedMaps();
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Start preloading assets first, then initialize Rive
    this.preloadAllAssets().then(() => {
      requestAnimationFrame(() => {
        this.initializeRiveAnimation();
      });
    });
    this.setupCanvasResizing();
  }

  ngOnDestroy(): void {
    // Clear all timers
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    // Reset animation state
    this.animationState = {
      sponsorTriggered: false,
      picksTriggered: false,
      bansTriggered: false
    };
    
    this.riveService.cleanup();
  }

  private async preloadAllAssets(): Promise<void> {
    console.log('🔄 Preloading all assets...');
    const startTime = performance.now();

    // Define all possible assets that might be used
    const allAssetUrls = [
      // Static assets
      '/assets/misc/logo.webp',
      '/assets/misc/icon.webp',
      
      // All possible map images
      '/assets/maps/wide/Ascent.webp',
      '/assets/maps/wide/Bind.webp',
      '/assets/maps/wide/Haven.webp',
      '/assets/maps/wide/Split.webp',
      '/assets/maps/wide/Lotus.webp',
      '/assets/maps/wide/Sunset.webp',
      '/assets/maps/wide/Icebox.webp',
    ];

    // Preload and process all assets in parallel
    const preloadPromises = allAssetUrls.map(async (url) => {
      try {
        const processedData = await this.riveService.preloadAndProcessAsset(url);
        this.preloadedAssets.set(url, processedData);
        return { url, success: true };
      } catch (error) {
        console.warn(`Failed to preload asset: ${url}`, error);
        return { url, success: false };
      }
    });

    const results = await Promise.all(preloadPromises);
    const successCount = results.filter(r => r.success).length;
    const loadTime = performance.now() - startTime;
    
    console.log(`✅ Preloaded ${successCount}/${allAssetUrls.length} assets in ${loadTime.toFixed(2)}ms`);
    this.isPreloadingComplete = true;
  }

  private async initializeRiveAnimation(): Promise<void> {
    if (!this.isPreloadingComplete) {
      console.warn('Initializing Rive before preloading complete');
    }

    const canvas = this.riveCanvas.nativeElement;
    this.resizeCanvas();
    
    const assets: MapbanAssets = {
      sponsor: '/assets/misc/logo.webp',
      eventLogo: '/assets/misc/icon.webp',
      t1_logo: '/assets/misc/icon.webp',
      t2_logo: '/assets/misc/icon.webp',
      map_1: '/assets/maps/wide/Ascent.webp',
      map_2: '/assets/maps/wide/Bind.webp',
      map_3: '/assets/maps/wide/Haven.webp',
      map_4: '/assets/maps/wide/Split.webp',
      map_5: '/assets/maps/wide/Lotus.webp',
      map_6: '/assets/maps/wide/Sunset.webp',
      map_7: '/assets/maps/wide/Icebox.webp',
    };

    try {
      // Pass preloaded assets to the service
      await this.riveService.initializeRive(canvas, assets, this.preloadedAssets);
      
      // Set up team information in the service
      this.riveService.setTeamInfo(0, this.teams[0]);
      this.riveService.setTeamInfo(1, this.teams[1]);
      
      // Set initial mapban colors using direct Rive access
      this.setColorsDirectlyOnRive(0x80152D, 0x1C8C74);
      
      // Execute the BO3 scenario immediately before animation starts
      this.executeFullBO3Immediately();
      
      console.log('🎬 Rive animation initialized with BO3 scenario pre-loaded');
    } catch (error) {
      console.error('Failed to initialize Rive animation:', error);
    }
  }

  private executeFullBO3Immediately(): void {
    console.log('🎮 Executing Full BO3 Scenario Immediately');
    
    // Execute all BO3 steps without any delays
    const bo3Steps = [
      // Phase 1: Initial Bans
      { action: 'ban', team: 0, map: 'Bind', description: 'Team 1 (SEN) bans Bind' },
      { action: 'ban', team: 1, map: 'Icebox', description: 'Team 2 (FNC) bans Icebox' },
      
      // Phase 2: Picks with sides
      { action: 'pick', team: 0, map: 'Ascent', side: 'ATTACK', description: 'Team 1 (SEN) picks Ascent' },
      { action: 'pick', team: 1, map: 'Haven', side: 'DEFENSE', description: 'Team 2 (FNC) picks Haven' },
      
      // Phase 3: Final Bans
      { action: 'ban', team: 0, map: 'Split', description: 'Team 1 (SEN) bans Split' },
      { action: 'ban', team: 1, map: 'Sunset', description: 'Team 2 (FNC) bans Sunset' },
      
      // Phase 4: Decider
      { action: 'decider', map: 'Lotus', description: 'Lotus remains as decider' },
      { action: 'side', team: 1, map: 'Lotus', side: 'ATTACK', description: 'Team 2 (FNC) picks Attack on Lotus' }
    ];

    // Process all steps immediately to set up the state
    bo3Steps.forEach((step, index) => {
      console.log(`📍 Step ${index + 1}: ${step.description}`);
      this.executeBO3StepImmediate(step);
    });

    // Schedule animations to play at specific times
    this.scheduleAnimationTriggers();
  }

  private executeBO3StepImmediate(step: any): void {
    this.actingTeam = step.team as 0 | 1;
    
    switch (step.action) {
      case 'ban':
        this.banMapImmediately(step.map, step.team);
        break;
        
      case 'pick':
        this.pickMapImmediately(step.map, step.team, step.side);
        break;
        
      case 'decider':
        this.setDeciderMapImmediately(step.map);
        break;
        
      case 'side':
        this.updateSideSelectionImmediate(step.map, step.team, step.side);
        break;
    }
  }

  private banMapImmediately(mapName: string, team: number): void {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          bannedBy: team as 0 | 1,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update map name text immediately
        this.riveService.updateMapNameText(emptySlotIndex + 1, this.mapNames[mapName]);
        
        // Update veto text immediately (no animation trigger)
        this.riveService.updateVetoText(emptySlotIndex + 1, 'VETO', team);
        
        // Update map image asset
        this.updateMapAssetForSlot(emptySlotIndex + 1, mapName);
      }
    }
  }

  private pickMapImmediately(mapName: string, team: number, side: 'ATTACK' | 'DEFENSE'): void {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          pickedBy: team as 0 | 1,
          sidePickedBy: team === 0 ? 1 : 0,
          pickedAttack: side === 'ATTACK' // Store side as boolean
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update map name text immediately
        this.riveService.updateMapNameText(emptySlotIndex + 1, this.mapNames[mapName]);
        
        // Update veto text immediately for pick (no animation trigger)
        this.riveService.updateVetoText(emptySlotIndex + 1, 'SELECT', team);
        
        // Update pick text with side selection immediately
        this.riveService.updatePickText(team, side, `Pick ${emptySlotIndex + 1}`);
        
        // Update map image asset
        this.updateMapAssetForSlot(emptySlotIndex + 1, mapName);
      }
    }
  }

  private setDeciderMapImmediately(mapName: string): void {
    const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
    if (emptySlotIndex !== -1) {
      this.selectedMaps[emptySlotIndex] = { 
        name: mapName, 
        pickedAttack: undefined 
      };
      this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
      
      // Update map name text immediately
      this.riveService.updateMapNameText(emptySlotIndex + 1, this.mapNames[mapName]);
      
      // Update veto text immediately for decider
      this.riveService.updateVetoText(emptySlotIndex + 1, 'DECIDER');
      
      // Update map image asset
      this.updateMapAssetForSlot(emptySlotIndex + 1, mapName);
    }
  }

  // ...existing code...

  // Add predefined scenario loading (no longer needed - using BO3 directly)
  private loadPredefinedScenario(): void {
    // Auto-load is now handled in initializeRiveAnimation
  }

  private scheduleDelayedAnimations(): void {
    const startTime = performance.now();
    let animationsComplete = false;
    
    const animationScheduler = () => {
      if (animationsComplete) return;
    
      const elapsed = performance.now() - startTime;
      
      if (elapsed >= 1000 && !this.animationState.sponsorTriggered) {
        this.animationState.sponsorTriggered = true;
        this.riveService.updateSponsorInfo(this.mockMatch.tools.sponsorInfo);
      }
      
      if (elapsed >= 1360 && !this.animationState.picksTriggered) {
        this.animationState.picksTriggered = true;
        this.executePicksBatch();
      }
      
      if (elapsed >= 2360 && !this.animationState.bansTriggered) {
        this.animationState.bansTriggered = true;
        this.executeBansBatch();
        animationsComplete = true;
        return;
      }
      
      if (!animationsComplete) {
        requestAnimationFrame(animationScheduler);
      }
    };
    
    requestAnimationFrame(animationScheduler);
  }

  private executePicksBatch(): void {
    const pickActions = [
      { action: 'pick', map: 'Ascent', team: 0 },
      { action: 'pick', map: 'Haven', team: 1 },
    ];

    // Collect all changes without triggering updates
    const mapUpdates: Array<{slot: number, banned: boolean, picked: boolean, team: number}> = [];
    
    pickActions.forEach((step) => {
      this.actingTeam = step.team as 0 | 1;
      const map = this.availableMaps.find(m => m.name === step.map);
      if (map) {
        const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
        if (emptySlotIndex !== -1) {
          this.selectedMaps[emptySlotIndex] = { 
            name: step.map, 
            pickedBy: this.actingTeam,
            sidePickedBy: this.actingTeam === 0 ? 1 : 0,
            pickedAttack: undefined 
          };
          this.availableMaps = this.availableMaps.filter(m => m.name !== step.map);
          
          // Collect the update instead of applying it immediately
          mapUpdates.push({
            slot: emptySlotIndex + 1,
            banned: false,
            picked: true,
            team: this.actingTeam
          });
        }
      }
    });

    // Apply all updates efficiently
    mapUpdates.forEach(update => {
      this.riveService.updateMapStatus(update.slot, update.banned, update.picked, update.team);
    });
    
    // Single asset update at the end
    this.updateRiveAssets();
  }

  private executeBansBatch(): void {
    // Execute ban actions as a batch for better performance
    const banActions = [
      { action: 'ban', map: 'Bind', team: 0 },
      { action: 'ban', map: 'Icebox', team: 1 },
      { action: 'ban', map: 'Split', team: 0 },
      { action: 'ban', map: 'Sunset', team: 1 },
    ];

    // Collect all changes without triggering updates
    const mapUpdates: Array<{slot: number, banned: boolean, picked: boolean, team: number}> = [];
    
    banActions.forEach((step) => {
      this.actingTeam = step.team as 0 | 1;
      const map = this.availableMaps.find(m => m.name === step.map);
      if (map) {
        const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
        if (emptySlotIndex !== -1) {
          this.selectedMaps[emptySlotIndex] = { 
            name: step.map, 
            bannedBy: this.actingTeam,
            pickedAttack: undefined 
          };
          this.availableMaps = this.availableMaps.filter(m => m.name !== step.map);
          
          // Collect the update instead of applying it immediately
          mapUpdates.push({
            slot: emptySlotIndex + 1,
            banned: true,
            picked: false,
            team: this.actingTeam
          });
        }
      }
    });

    // Apply all updates efficiently
    mapUpdates.forEach(update => {
      this.riveService.updateMapStatus(update.slot, update.banned, update.picked, update.team);
    });

    // Single asset update at the end
    this.updateRiveAssets();
  }

  private executeBanAnimations(): void {
    // Execute only the ban actions from the BO3 scenario
    const banActions = [
      { action: 'ban', map: 'Bind', team: 0, description: 'Team 1 bans Bind' },
      { action: 'ban', map: 'Icebox', team: 1, description: 'Team 2 bans Icebox' },
      { action: 'ban', map: 'Split', team: 0, description: 'Team 1 bans Split' },
      { action: 'ban', map: 'Sunset', team: 1, description: 'Team 2 bans Sunset' },
    ];

    banActions.forEach((step, index) => {
      this.actingTeam = step.team as 0 | 1;
      console.log(`📍 Ban Step ${index + 1}/4: ${step.description}`);
      this.banMap(step.map);
    });
  }

  // Method to simulate a complete BO3 mapban scenario (immediate execution)
  loadFullBO3Scenario(): void {
    this.reset();
    console.log('🎮 Starting Full BO3 Scenario (Immediate)');
    
    // Execute all BO3 steps immediately without delays
    const bo3Steps = [
      // Phase 1: Initial Bans
      { action: 'ban', team: 0, map: 'Bind', description: 'Team 1 (SEN) bans Bind' },
      { action: 'ban', team: 1, map: 'Icebox', description: 'Team 2 (FNC) bans Icebox' },
      
      // Phase 2: Picks with sides
      { action: 'pick', team: 0, map: 'Ascent', side: 'ATTACK', description: 'Team 1 (SEN) picks Ascent' },
      { action: 'pick', team: 1, map: 'Haven', side: 'DEFENSE', description: 'Team 2 (FNC) picks Haven' },
      
      // Phase 3: Final Bans
      { action: 'ban', team: 0, map: 'Split', description: 'Team 1 (SEN) bans Split' },
      { action: 'ban', team: 1, map: 'Sunset', description: 'Team 2 (FNC) bans Sunset' },
      
      // Phase 4: Decider
      { action: 'decider', map: 'Lotus', description: 'Lotus remains as decider' },
      { action: 'side', team: 1, map: 'Lotus', side: 'ATTACK', description: 'Team 2 (FNC) picks Attack on Lotus' }
    ];

    // Process all steps immediately
    bo3Steps.forEach((step, index) => {
      console.log(`📍 Step ${index + 1}: ${step.description}`);
      this.actingTeam = step.team as 0 | 1;
      
      switch (step.action) {
        case 'ban':
          if (step.team !== undefined) {
            this.banMapWithText(step.map, step.team);
          }
          break;
          
        case 'pick':
          if (step.team !== undefined && step.side !== undefined) {
            this.pickMapWithText(step.map, step.team, step.side as 'ATTACK' | 'DEFENSE');
          }
          break;
          
        case 'decider':
          this.setDeciderMapWithText(step.map);
          break;
          
        case 'side':
          if (step.team !== undefined && step.side !== undefined) {
            this.updateSideSelection(step.map, step.team, step.side as 'ATTACK' | 'DEFENSE');
          }
          break;
      }
    });
  }

  private executeBO3Steps(): void {
    const bo3Steps = [
      // Phase 1: Initial Bans
      { delay: 0, action: 'ban', team: 0, map: 'Bind', description: 'Team 1 (SEN) bans Bind' },
      { delay: 1000, action: 'ban', team: 1, map: 'Icebox', description: 'Team 2 (FNC) bans Icebox' },
      
      // Phase 2: Picks with sides
      { delay: 2000, action: 'pick', team: 0, map: 'Ascent', side: 'ATTACK', description: 'Team 1 (SEN) picks Ascent' },
      { delay: 3000, action: 'side', team: 1, map: 'Ascent', side: 'DEFENSE', description: 'Team 2 (FNC) picks Defense on Ascent' },
      { delay: 4000, action: 'pick', team: 1, map: 'Haven', side: 'DEFENSE', description: 'Team 2 (FNC) picks Haven' },
      { delay: 5000, action: 'side', team: 0, map: 'Haven', side: 'ATTACK', description: 'Team 1 (SEN) picks Attack on Haven' },
      
      // Phase 3: Final Bans
      { delay: 6000, action: 'ban', team: 0, map: 'Split', description: 'Team 1 (SEN) bans Split' },
      { delay: 7000, action: 'ban', team: 1, map: 'Sunset', description: 'Team 2 (FNC) bans Sunset' },
      
      // Phase 4: Decider
      { delay: 8000, action: 'decider', map: 'Lotus', description: 'Lotus remains as decider' }
    ];

    bo3Steps.forEach(step => {
      setTimeout(() => {
        console.log(`📍 ${step.description}`);
        this.executeBO3Step(step);
      }, step.delay);
    });
  }

  private executeBO3Step(step: any): void {
    this.actingTeam = step.team as 0 | 1;
    const mapName = this.mapNames[step.map] || step.map;
    
    switch (step.action) {
      case 'ban':
        this.banMapWithText(step.map, step.team);
        break;
        
      case 'pick':
        this.pickMapWithText(step.map, step.team, step.side);
        break;
        
      case 'side':
        // Update the side selection for the previously picked map
        this.updateSideSelection(step.map, step.team, step.side);
        break;
        
      case 'decider':
        this.setDeciderMapWithText(step.map);
        break;
    }
  }

  private banMapWithText(mapName: string, team: number): void {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          bannedBy: team as 0 | 1,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive with text
        this.riveService.updateMapStatus(
          emptySlotIndex + 1, 
          true, 
          false, 
          team,
          this.mapNames[mapName]
        );
      }
    }
    this.updateRiveAssets();
  }

  private pickMapWithText(mapName: string, team: number, side: 'ATTACK' | 'DEFENSE'): void {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          pickedBy: team as 0 | 1,
          sidePickedBy: team === 0 ? 1 : 0,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive with text and side selection
        const sideSelection: SideSelection = { team, side };
        this.riveService.updateMapStatus(
          emptySlotIndex + 1, 
          false, 
          true, 
          team,
          this.mapNames[mapName],
          sideSelection
        );
      }
    }
    this.updateRiveAssets();
  }

  private updateSideSelection(mapName: string, team: number, side: 'ATTACK' | 'DEFENSE'): void {
    // Find the picked map and update side information
    const selectedMap = this.selectedMaps.find(m => m.name === mapName);
    if (selectedMap && selectedMap.pickedBy !== undefined) {
      // Update the pick text with the side selection
      const mapSlot = this.selectedMaps.findIndex(m => m.name === mapName) + 1;
      const sideSelection: SideSelection = { team, side };
      
      // Re-trigger the pick animation with updated side text
      this.riveService.updateMapStatus(
        mapSlot, 
        false, 
        true, 
        selectedMap.pickedBy,
        this.mapNames[mapName],
        sideSelection
      );
    }
  }

  private setDeciderMapWithText(mapName: string): void {
    // Find the last remaining map slot
    const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
    if (emptySlotIndex !== -1) {
      this.selectedMaps[emptySlotIndex] = { 
        name: mapName, 
        pickedAttack: undefined 
      };
      this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
      
      // Set as decider map with special text
      this.riveService.setDeciderMap(emptySlotIndex + 1, this.mapNames[mapName]);
    }
    this.updateRiveAssets();
  }

  // Method to simulate just bans
  loadAllBansScenario(): void {
    this.reset();
    
    // Schedule ban animations at 2.36 seconds
    setTimeout(() => {
      const bans = [
        { map: 'Bind', team: 0 },
        { map: 'Icebox', team: 1 },
        { map: 'Split', team: 0 },
        { map: 'Sunset', team: 1 },
        { map: 'Haven', team: 0 },
        { map: 'Lotus', team: 1 },
      ];

      bans.forEach((ban, index) => {
        this.actingTeam = ban.team as 0 | 1;
        this.banMapBatch(ban.map);
      });
      
      // Single asset update at the end
      this.updateRiveAssets();
    }, 2360);
  }

  // Method to simulate just picks
  loadAllPicksScenario(): void {
    this.reset();
    
    // Schedule pick animations at 1.36 seconds
    setTimeout(() => {
      const picks = [
        { map: 'Ascent', team: 0 },
        { map: 'Bind', team: 1 },
        { map: 'Haven', team: 0 },
        { map: 'Split', team: 1 },
        { map: 'Lotus', team: 0 },
      ];

      picks.forEach((pick, index) => {
        this.actingTeam = pick.team as 0 | 1;
        this.pickMapBatch(pick.map);
      });
      
      // Single asset update at the end
      this.updateRiveAssets();
    }, 1360);
  }

  // Method to load a custom scenario from configuration
  loadCustomScenario(scenarioConfig: any[]): void {
    console.log('Loading custom scenario...');
    this.reset();
    
    scenarioConfig.forEach((step, index) => {
      this.actingTeam = step.team;
      
      if (step.action === 'ban') {
        this.banMap(step.map);
      } else if (step.action === 'pick') {
        this.pickMap(step.map);
      }
    });
  }

  getInitialMaps(): SessionMap[] {
    return [
      { name: "Ascent", pickedAttack: undefined },
      { name: "Bind", pickedAttack: undefined },
      { name: "Haven", pickedAttack: undefined },
      { name: "Split", pickedAttack: undefined },
      { name: "Lotus", pickedAttack: undefined },
      { name: "Sunset", pickedAttack: undefined },
      { name: "Icebox", pickedAttack: undefined },
    ];
  }

  initializeSelectedMaps() {
    // Create 7 slots for mapban
    this.selectedMaps = [];
    for (let i = 0; i < 7; i++) {
      this.selectedMaps.push({ name: "", pickedAttack: undefined });
    }
  }

  private pickMapBatch(mapName: string) {
    // Optimized version without individual asset updates
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          pickedBy: this.actingTeam,
          sidePickedBy: this.actingTeam === 0 ? 1 : 0,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive status only (no asset update)
        this.riveService.updateMapStatus(emptySlotIndex + 1, false, true, this.actingTeam);
      }
    }
  }

  private banMapBatch(mapName: string) {
    // Optimized version without individual asset updates
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          bannedBy: this.actingTeam,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive status only (no asset update)
        this.riveService.updateMapStatus(emptySlotIndex + 1, true, false, this.actingTeam);
      }
    }
  }

  banMap(mapName: string) {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      // Find the first empty slot
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          bannedBy: this.actingTeam,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive with the specific map ban
        this.riveService.updateMapStatus(emptySlotIndex + 1, true, false, this.actingTeam);
        
        // Update assets immediately (but debounced)
        this.debouncedUpdateAssets();
      }
    }
  }

  pickMap(mapName: string) {
    const map = this.availableMaps.find(m => m.name === mapName);
    if (map) {
      // Find the first empty slot
      const emptySlotIndex = this.selectedMaps.findIndex(m => m.name === "");
      if (emptySlotIndex !== -1) {
        this.selectedMaps[emptySlotIndex] = { 
          name: mapName, 
          pickedBy: this.actingTeam,
          sidePickedBy: this.actingTeam === 0 ? 1 : 0,
          pickedAttack: undefined 
        };
        this.availableMaps = this.availableMaps.filter(m => m.name !== mapName);
        
        // Update Rive with the specific map pick
        this.riveService.updateMapStatus(emptySlotIndex + 1, false, true, this.actingTeam);
        
        // Update assets immediately (but debounced)
        this.debouncedUpdateAssets();
      }
    }
  }

  private debouncedUpdateAssets(): void {
    // Clear any pending update
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    // Schedule a new update with a longer delay to batch more calls
    this.updateDebounceTimer = window.setTimeout(() => {
      this.updateRiveAssets();
      this.updateDebounceTimer = undefined;
    }, 32); // Increased to ~30fps for better batching
  }

  reset() {
    this.stage = 'ban';
    this.actingTeam = 0;
    this.availableMaps = this.getInitialMaps();
    this.initializeSelectedMaps();
    
    // Reset animation state
    this.animationState = {
      sponsorTriggered: false,
      picksTriggered: false,
      bansTriggered: false
    };
    
    // Reset colors to default
    this.resetColors();
    
    // Reset Rive states
    this.riveService.resetMapStates();
    this.riveService.updateSponsorInfo(this.mockMatch.tools.sponsorInfo);
    
    this.updateRiveAssets();
  }

  updateRiveAssets() {
    // Early return if Rive isn't ready
    if (!this.riveService.getRive()) {
      return;
    }
    
    // Since assets are preloaded, this should be instant
    const assets: MapbanAssets = {
      sponsor: '/assets/misc/icon.webp',
      eventLogo: '/assets/misc/icon.webp',
      t1_logo: '/assets/misc/icon.webp',
      t2_logo: '/assets/misc/icon.webp',
      map_1: this.selectedMaps[0]?.name ? `/assets/maps/wide/${this.selectedMaps[0].name}.webp` : '/assets/maps/wide/Ascent.webp',
      map_2: this.selectedMaps[1]?.name ? `/assets/maps/wide/${this.selectedMaps[1].name}.webp` : '/assets/maps/wide/Bind.webp',
      map_3: this.selectedMaps[2]?.name ? `/assets/maps/wide/${this.selectedMaps[2].name}.webp` : '/assets/maps/wide/Haven.webp',
      map_4: this.selectedMaps[3]?.name ? `/assets/maps/wide/${this.selectedMaps[3].name}.webp` : '/assets/maps/wide/Split.webp',
      map_5: this.selectedMaps[4]?.name ? `/assets/maps/wide/${this.selectedMaps[4].name}.webp` : '/assets/maps/wide/Lotus.webp',
      map_6: this.selectedMaps[5]?.name ? `/assets/maps/wide/${this.selectedMaps[5].name}.webp` : '/assets/maps/wide/Sunset.webp',
      map_7: this.selectedMaps[6]?.name ? `/assets/maps/wide/${this.selectedMaps[6].name}.webp` : '/assets/maps/wide/Icebox.webp',
    };
    
    // Use preloaded assets for instant updates
    this.riveService.updateAssetsFromPreloaded(assets, this.preloadedAssets);
  }

  /**
   * Update mapban colors - simplified direct approach
   */
  updateMapbanColors(primaryColor?: string, secondaryColor?: string): void {
    console.log('🎨 updateMapbanColors called with:', { primaryColor, secondaryColor });
    
    // Use hex values directly without conversion
    let primaryHex = 0x80152D;   // Default primary color
    let secondaryHex = 0x1C8C74; // Default secondary color
    
    // Only convert if string values are provided (from color picker)
    if (primaryColor) {
      primaryHex = parseInt(primaryColor.replace('#', ''), 16);
    }
    if (secondaryColor) {
      secondaryHex = parseInt(secondaryColor.replace('#', ''), 16);
    }
    
    console.log('🎨 Setting colors:', { 
      primaryHex: `0x${primaryHex.toString(16).toUpperCase()}`, 
      secondaryHex: `0x${secondaryHex.toString(16).toUpperCase()}`
    });
    
    // Update stored values
    this.mapbanColors.primaryColor = primaryHex;
    this.mapbanColors.secondaryColor = secondaryHex;
    
    // Set colors directly on Rive viewModelInstance (like agent select component)
    this.setColorsDirectlyOnRive(primaryHex, secondaryHex);
  }

  /**
   * Set colors directly on Rive viewModelInstance (same pattern as agent select)
   */
  private setColorsDirectlyOnRive(primaryColor: number, secondaryColor: number): void {
    const rive = this.riveService.getRive();
    if (!rive) {
      console.warn('Cannot set colors - Rive not available');
      return;
    }

    try {
      const viewModelInstance = rive.viewModelInstance;
      if (viewModelInstance) {
        // Access color properties directly (try different property names)
        const primaryColorProperty = viewModelInstance.color('mapbanPrimaryColor') || viewModelInstance.color('primaryColor');
        const secondaryColorProperty = viewModelInstance.color('mapbanSecondaryColor') || viewModelInstance.color('secondaryColor');
        
        if (primaryColorProperty) {
          primaryColorProperty.value = primaryColor;
          console.log(`✅ Set primary color: 0x${primaryColor.toString(16).toUpperCase()}`);
        } else {
          console.warn('❌ Primary color property not found');
        }
        
        if (secondaryColorProperty) {
          secondaryColorProperty.value = secondaryColor;
          console.log(`✅ Set secondary color: 0x${secondaryColor.toString(16).toUpperCase()}`);
        } else {
          console.warn('❌ Secondary color property not found');
        }
      } else {
        console.warn('❌ ViewModelInstance not available');
      }
    } catch (error) {
      console.error('❌ Error setting colors directly:', error);
    }
  }

  toggleSponsors() {
    this.mockMatch.tools.sponsorInfo.enabled = !this.mockMatch.tools.sponsorInfo.enabled;
    this.riveService.updateSponsorInfo(this.mockMatch.tools.sponsorInfo);
    console.log('Toggled sponsors:', this.mockMatch.tools.sponsorInfo.enabled);
  }

  cycleSponsor() {
    if (this.mockMatch.tools.sponsorInfo.enabled && this.mockMatch.tools.sponsorInfo.sponsors.length > 0) {
      this.currentSponsorIndex = (this.currentSponsorIndex + 1) % this.mockMatch.tools.sponsorInfo.sponsors.length;
      this.riveService.cycleSponsor(this.mockMatch.tools.sponsorInfo.sponsors, this.currentSponsorIndex);
      console.log('Cycled to sponsor index:', this.currentSponsorIndex);
    }
  }

  debugInputs() {
    console.log('=== RIVE DEBUG INFO ===');
    this.riveService.debugListInputs();
    console.log('Current states:', this.riveService.getCurrentStates());
    console.log('Selected maps:', this.selectedMaps);
    console.log('Mapban colors:', this.mapbanColors);
    console.log('======================');
  }

  private setupCanvasResizing(): void {
    const canvas = this.riveCanvas.nativeElement;
    let resizeTimeout: number;
    
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize operations more aggressively
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this.resizeCanvas();
      }, 100); // Increased debounce time for better performance
    });
    
    resizeObserver.observe(canvas.parentElement!);
  }

  private resizeCanvas(): void {
    const canvas = this.riveCanvas.nativeElement;
    const container = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    
    // Set display size
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    
    // Set actual canvas size in memory (scaled for high DPI)
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    
    // If Rive is already initialized, trigger a layout update
    const rive = this.riveService.getRive();
    if (rive) {
      rive.resizeDrawingSurfaceToCanvas();
    }
  }

  private updateSideSelectionImmediate(mapName: string, team: number, side: 'ATTACK' | 'DEFENSE'): void {
    // Find the map and update side information
    const selectedMap = this.selectedMaps.find(m => m.name === mapName);
    if (selectedMap && selectedMap.name === mapName) {
      // Update the stored side information
      selectedMap.pickedAttack = side === 'ATTACK';
      selectedMap.sidePickedBy = team as 0 | 1;
      
      const mapSlot = this.selectedMaps.findIndex(m => m.name === mapName) + 1;
      
      // DO NOT change the veto text - it should remain "DECIDER MAP" for decider maps
      // Only update the pick text with side selection
      this.riveService.updatePickText(team, side, `Pick ${mapSlot}`);
      
      console.log(`Side selection updated for ${mapName}: Team ${team} picks ${side}`);
    }
  }

  private scheduleAnimationTriggers(): void {
    // Schedule pick animations at 1.36 seconds
    setTimeout(() => {
      console.log('🎬 Triggering PICK animations at 1.36s');
      this.triggerPickAnimations();
    }, 1600);
    
    // Schedule ban animations at 2.36 seconds  
    setTimeout(() => {
      console.log('🎬 Triggering BAN animations at 2.36s');
      this.triggerBanAnimations();
    }, 2360);
  }

  private triggerPickAnimations(): void {
    // Trigger pick animations for maps that were picked OR are deciders with side selection
    this.selectedMaps.forEach((selectedMap, index) => {
      if (selectedMap.pickedBy !== undefined || (selectedMap.name !== "" && selectedMap.bannedBy === undefined && selectedMap.sidePickedBy !== undefined)) {
        const mapSlot = index + 1;
        console.log(`Triggering pick animation for slot ${mapSlot}: ${selectedMap.name}`);
        
        // Fire the pick animation only (text was already updated immediately)
        this.riveService.setRiveInput('isPicked', true, `Pick ${mapSlot}`);
      }
    });
  }

  private triggerBanAnimations(): void {
    // Trigger ban animations for maps that were banned
    this.selectedMaps.forEach((selectedMap, index) => {
      if (selectedMap.bannedBy !== undefined) {
        const mapSlot = index + 1;
        console.log(`Triggering ban animation for slot ${mapSlot}: ${selectedMap.name}`);
        
        // Fire the ban animation only (text was already updated immediately)
        this.riveService.setRiveInput('isBanned', true, `Ban ${mapSlot}`);
      }
    });
  }

  private updateMapAssetForSlot(mapSlot: number, mapName: string): void {
    // Update the map image asset for the specific slot
    const assetKey = `map_${mapSlot}` as keyof MapbanAssets;
    const mapImageUrl = `/assets/maps/wide/${mapName}.webp`;
    
    console.log(`Attempting to update asset for slot ${mapSlot}: ${mapName} -> ${mapImageUrl}`);
    
    // Update the asset if it's preloaded
    if (this.preloadedAssets.has(mapImageUrl)) {
      // Create a full assets object for the update (service might need all assets)
      const currentAssets: MapbanAssets = {
        sponsor: '/assets/misc/icon.webp',
        eventLogo: '/assets/misc/icon.webp',
        t1_logo: '/assets/misc/icon.webp',
        t2_logo: '/assets/misc/icon.webp',
        map_1: this.selectedMaps[0]?.name ? `/assets/maps/wide/${this.selectedMaps[0].name}.webp` : '/assets/maps/wide/Ascent.webp',
        map_2: this.selectedMaps[1]?.name ? `/assets/maps/wide/${this.selectedMaps[1].name}.webp` : '/assets/maps/wide/Bind.webp',
        map_3: this.selectedMaps[2]?.name ? `/assets/maps/wide/${this.selectedMaps[2].name}.webp` : '/assets/maps/wide/Haven.webp',
        map_4: this.selectedMaps[3]?.name ? `/assets/maps/wide/${this.selectedMaps[3].name}.webp` : '/assets/maps/wide/Split.webp',
        map_5: this.selectedMaps[4]?.name ? `/assets/maps/wide/${this.selectedMaps[4].name}.webp` : '/assets/maps/wide/Lotus.webp',
        map_6: this.selectedMaps[5]?.name ? `/assets/maps/wide/${this.selectedMaps[5].name}.webp` : '/assets/maps/wide/Sunset.webp',
        map_7: this.selectedMaps[6]?.name ? `/assets/maps/wide/${this.selectedMaps[6].name}.webp` : '/assets/maps/wide/Icebox.webp',
      };
      
      this.riveService.updateAssetsFromPreloaded(currentAssets, this.preloadedAssets);
      console.log(`✅ Updated map asset for slot ${mapSlot}: ${mapName}`);
    } else {
      console.warn(`❌ Map asset not preloaded: ${mapImageUrl}`);
    }
  }

  /**
   * Get hex display string for a color number
   */
  getHexDisplay(colorValue: number): string {
    return `#${colorValue.toString(16).toUpperCase().padStart(6, '0')}`;
  }

  /**
   * Reset colors to default values - using hex directly
   */
  resetColors(): void {
    // Set to default hex values directly
    this.mapbanColors.primaryColor = 0x80152D;
    this.mapbanColors.secondaryColor = 0x1C8C74;
    
    // Set directly on Rive
    this.setColorsDirectlyOnRive(0x80152D, 0x1C8C74);
  }

  /**
   * Test color setting specifically - using hex values directly
   */
  testColors(): void {
    console.log('🧪 Testing color functionality...');
    
    // Use hex values directly (no conversion)
    const testPrimary = 0xFF0000; // Bright red
    const testSecondary = 0x00FF00; // Bright green
    
    console.log(`🧪 Setting test colors: primary=0x${testPrimary.toString(16)}, secondary=0x${testSecondary.toString(16)}`);
    
    // Update stored values
    this.mapbanColors.primaryColor = testPrimary;
    this.mapbanColors.secondaryColor = testSecondary;
    
    // Set directly on Rive
    this.setColorsDirectlyOnRive(testPrimary, testSecondary);
    
    // Update UI color inputs
    setTimeout(() => {
      const primaryInput = document.querySelector('input[type="color"]') as HTMLInputElement;
      const secondaryInput = document.querySelectorAll('input[type="color"]')[1] as HTMLInputElement;
      
      if (primaryInput) {
        primaryInput.value = '#FF0000';
      }
      if (secondaryInput) {
        secondaryInput.value = '#00FF00';
      }
    }, 100);
  }

  /**
   * Force refresh colors - using hex values directly
   */
  forceRefreshColors(): void {
    console.log('🔄 Force refreshing colors...');
    
    // Use stored hex values directly
    const currentPrimary = this.mapbanColors.primaryColor;
    const currentSecondary = this.mapbanColors.secondaryColor;
    
    console.log(`🔄 Current stored colors: primary=0x${currentPrimary.toString(16).toUpperCase()}, secondary=0x${currentSecondary.toString(16).toUpperCase()}`);
    
    // Set directly on Rive
    this.setColorsDirectlyOnRive(currentPrimary, currentSecondary);
  }
}
