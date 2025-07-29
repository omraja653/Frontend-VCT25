import { Component, inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { SocketService } from "../../services/SocketService";
import { Config } from "../../shared/config";
import { RiveMapbanFsService, MapbanFsAssets, SponsorInfo, MapState, TeamInfo, SideSelection } from "../../services/rive-mapban-fs.service";
import { CommonModule } from "@angular/common";

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: "app-mapban-fs",
  templateUrl: "./mapban-fs.component.html",
  styleUrls: ["./mapban-fs.component.scss"]
})
export class MapbanFsComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('riveCanvas', { static: true }) riveCanvas!: ElementRef<HTMLCanvasElement>;
  
  private route = inject(ActivatedRoute);
  private config = inject(Config);
  @Input() data!: ISessionData;

  sessionCode = "UNKNOWN";
  socketService!: SocketService;

  // Rive mapban fullscreen service
  private riveService = inject(RiveMapbanFsService);
  
  // Asset preloading
  private preloadedAssets: Map<string, Uint8Array> = new Map();
  private isPreloadingComplete = false;
  
  // Match data for assets
  private match: any = null;

  constructor() {
    const params = this.route.snapshot.queryParams;
    this.sessionCode = params["sessionId"] || "UNKNOWN";
  }

  ngOnInit(): void {
    this.socketService = SocketService.getInstance();
    this.socketService.subscribeMapban((data: any) => {
      this.updateMapbanData(data);
    });
    this.socketService.connectMapban(this.config.mapbanEndpoint, {
      sessionId: this.sessionCode,
    });
  }

  ngAfterViewInit(): void {
    this.socketService.subscribeMatch((data: any) => {
      // Store match data for asset loading
      this.match = data;
      this.updateMapbanData(data);
    });
    
    // Add test match data if no real data is available
    if (!this.match) {
      console.log('🧪 No match data available, using test data for mapban-fs');
      this.match = {
        teams: [
          { name: "Sentinels", tricode: "SEN", teamUrl: "/assets/misc/icon.webp" },
          { name: "Fnatic", tricode: "FNC", teamUrl: "/assets/misc/icon.webp" }
        ],
        tools: {
          sponsorInfo: {
            enabled: true,
            sponsors: ["/assets/misc/icon.webp"]
          }
        }
      };
    }
    
    // Add test session data if no real data is available
    if (!this.data) {
      console.log('🧪 No session data available, using test data for mapban-fs');
      this.data = {
        sessionIdentifier: "test-session",
        organizationName: "Test Org",
        teams: [
          { name: "Sentinels", tricode: "SEN", url: "/assets/misc/icon.webp" },
          { name: "Fnatic", tricode: "FNC", url: "/assets/misc/icon.webp" }
        ],
        format: "bo3",
        availableMaps: [],
        selectedMaps: [
          // Test BO3 scenario: maps 1,2,3,4 are banned, maps 5,6,7 are picked
          Object.assign(new SessionMap("Ascent"), { bannedBy: 0 }),
          Object.assign(new SessionMap("Bind"), { bannedBy: 1 }),
          Object.assign(new SessionMap("Haven"), { bannedBy: 0 }),
          Object.assign(new SessionMap("Split"), { bannedBy: 1 }),
          Object.assign(new SessionMap("Lotus"), { pickedBy: 0 }),
          Object.assign(new SessionMap("Sunset"), { pickedBy: 1 }),
          Object.assign(new SessionMap("Icebox"), {}) // Decider map
        ],
        stage: "pick" as Stage,
        actingTeamCode: "SEN",
        actingTeam: 0
      };
    }
    
    // Initialize Rive animation after view is ready
    this.initializeRiveAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && changes["data"].currentValue) {
      this.updateMapbanData({ data: changes["data"].currentValue });
    }
  }

  ngOnDestroy(): void {
    this.riveService.cleanup();
  }

  private async initializeRiveAnimation(): Promise<void> {
    try {
      console.log('🎬 Starting Rive mapban-fs animation initialization...');
      
      // Preload all assets first for performance
      await this.preloadAllAssets();
      
      // Set up initial mapban assets
      const assets = this.buildMapbanAssets();
      
      console.log('🎯 Initializing Rive with canvas:', this.riveCanvas.nativeElement);
      console.log('📁 Using Rive file: /assets/mapban/mapban-fs/mapban-fs.riv');
      
      // Initialize Rive with preloaded assets
      await this.riveService.initializeRive(
        this.riveCanvas.nativeElement,
        assets,
        this.preloadedAssets
      );
      
      console.log('🎬 Rive mapban-fs animation initialized successfully');
      
      // Force an immediate update with test data
      console.log('📊 Triggering immediate animation update with test data...');
      this.updateRiveAnimation();
      
    } catch (error) {
      console.error('❌ Failed to initialize Rive mapban-fs animation:', error);
    }
  }

  private async preloadAllAssets(): Promise<void> {
    if (this.isPreloadingComplete) return;
    
    console.log('🔄 Starting asset preloading for mapban-fs...');
    const startTime = performance.now();
    
    // Get all possible asset URLs - include team logos and other assets
    const allAssetUrls = [
      '/assets/misc/icon.webp', // Default fallback
      '/assets/maps/wide/Ascent.webp',
      '/assets/maps/wide/Bind.webp',
      '/assets/maps/wide/Haven.webp',
      '/assets/maps/wide/Split.webp',
      '/assets/maps/wide/Lotus.webp',
      '/assets/maps/wide/Sunset.webp',
      '/assets/maps/wide/Icebox.webp',
      '/assets/maps/wide/Breeze.webp',
      '/assets/maps/wide/Fracture.webp',
      '/assets/maps/wide/Pearl.webp'
    ];

    // Add team logo URLs if available
    if (this.match?.teams?.[0]?.teamUrl) {
      allAssetUrls.push(this.match.teams[0].teamUrl);
    }
    if (this.match?.teams?.[1]?.teamUrl) {
      allAssetUrls.push(this.match.teams[1].teamUrl);
    }

    const preloadPromises = allAssetUrls.map(async (url) => {
      try {
        const processedData = await this.riveService.preloadAndProcessAsset(url);
        this.preloadedAssets.set(url, processedData);
        console.log(`✅ Preloaded: ${url}`);
        return { url, success: true };
      } catch (error) {
        console.warn(`❌ Failed to preload asset: ${url}`, error);
        return { url, success: false };
      }
    });

    const results = await Promise.all(preloadPromises);
    const successCount = results.filter(r => r.success).length;
    const loadTime = performance.now() - startTime;
    
    console.log(`✅ Preloaded ${successCount}/${allAssetUrls.length} assets for mapban-fs in ${loadTime.toFixed(2)}ms`);
    this.isPreloadingComplete = true;
  }

  private getMapImageUrls(): string[] {
    const mapNames = ['Ascent', 'Bind', 'Haven', 'Split', 'Lotus', 'Sunset', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Abyss', 'Corrode'];
    return mapNames.map(name => `/assets/maps/wide/${name}.webp`);
  }

  private buildMapbanAssets(): MapbanFsAssets {
    const assets: MapbanFsAssets = {
      sponsor: this.match?.tools?.sponsorInfo?.sponsors?.[0] || '/assets/misc/icon.webp',
      eventLogo: '/assets/misc/icon.webp',
      t1_logo: this.match?.teams?.[0]?.teamUrl || '/assets/misc/icon.webp',
      t2_logo: this.match?.teams?.[1]?.teamUrl || '/assets/misc/icon.webp',
      team1_logo: this.match?.teams?.[0]?.teamUrl || '/assets/misc/icon.webp', // Team 1 logo for past maps
      team2_logo: this.match?.teams?.[1]?.teamUrl || '/assets/misc/icon.webp', // Team 2 logo for past maps
    };

    // Add map assets for maps 1-7 (all possible map slots)
    for (let i = 1; i <= 7; i++) {
      const mapKey = `map_${i}` as keyof MapbanFsAssets;
      if (this.data?.selectedMaps?.[i - 1]?.name) {
        assets[mapKey] = `/assets/maps/wide/${this.data.selectedMaps[i - 1].name}.webp`;
      } else {
        assets[mapKey] = '/assets/maps/wide/Ascent.webp'; // Default fallback
      }
    }

    console.log('🏗️ Built mapban-fs assets:', assets);
    console.log('📊 Current data:', this.data);
    console.log('🏟️ Current match:', this.match);
    return assets;
  }

  private updateMapbanData(socketData: any): void {
    if (socketData.data) {
      this.data = socketData.data;
    }
    if (socketData.match) {
      this.match = socketData.match;
    }
    
    // Update Rive animation based on the data
    this.updateRiveAnimation();
  }

  private updateRiveAnimation(): void {
    if (!this.data || !this.riveService.getRive()) {
      console.log('⏸️ Skipping Rive update - missing data or Rive not initialized');
      return;
    }
    
    console.log('🔄 Updating Rive animation with data:', this.data);
    
    // Determine series format and set appropriate artboard
    this.setSeriesArtboard();
    
    // Set team information
    this.setTeamInformation();
    
    // Process map states and update ban/pick information
    this.processMapStates();
    
    // Update sponsor information if available
    if (this.match?.tools?.sponsorInfo) {
      console.log('📢 Updating sponsor info:', this.match.tools.sponsorInfo);
      this.riveService.updateSponsorInfo(this.match.tools.sponsorInfo);
    }
    
    // Update assets if they've changed
    const newAssets = this.buildMapbanAssets();
    this.riveService.updateAssetsFromPreloaded(newAssets, this.preloadedAssets);
    
    console.log('✅ Rive animation update completed');
  }

  private setSeriesArtboard(): void {
    if (!this.data?.selectedMaps) return;
    
    // Count total bans to determine series format
    const totalBans = this.data.selectedMaps.filter(map => map.bannedBy !== undefined).length;
    
    // BO3: 4 bans total, BO5: 2 bans total
    const isBO3 = totalBans === 4;
    const isBO5 = totalBans === 2;
    
    if (isBO3) {
      this.riveService.setArtboard('BO3');
      console.log('🎯 Set artboard to BO3 (4 bans detected)');
    } else if (isBO5) {
      this.riveService.setArtboard('BO5');
      console.log('🎯 Set artboard to BO5 (2 bans detected)');
    }
  }

  private setTeamInformation(): void {
    if (!this.data?.teams) return;
    
    // Set TEAM 1 and TEAM 2 text runs
    this.riveService.setTextRun('TEAM 1', this.data.teams[0]?.name || 'TEAM 1');
    this.riveService.setTextRun('TEAM 2', this.data.teams[1]?.name || 'TEAM 2');
    
    // Store team info for later use
    for (let i = 0; i < this.data.teams.length; i++) {
      const teamInfo: TeamInfo = {
        tricode: this.data.teams[i].tricode || 'TEAM',
        name: this.data.teams[i].name || 'Team Name'
      };
      this.riveService.setTeamInfo(i, teamInfo);
    }
  }

  private processMapStates(): void {
    if (!this.data?.selectedMaps) return;
    
    const mapStates: MapState[] = [];
    
    this.data.selectedMaps.forEach((sessionMap, index) => {
      const mapNumber = index + 1;
      const mapState: MapState = {
        mapNumber,
        mapName: sessionMap.name,
        isBanned: sessionMap.bannedBy !== undefined,
        isPicked: sessionMap.pickedBy !== undefined,
        bannedBy: sessionMap.bannedBy,
        pickedBy: sessionMap.pickedBy,
        isPastMap: this.isPastMap(sessionMap), // Check if this is a past map with scores
        mapScore: this.getMapScore(sessionMap) // Get score if it's a past map
      };
      mapStates.push(mapState);
      
      // Set map name for banned maps in ALL CAPS (maps 1-2 and 5-6 for BO3, maps 1-2 for BO5)
      if (mapState.isBanned) {
        this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, (sessionMap.name || '').toUpperCase());
      }
      
      // Update pick information for maps 3-7
      if (mapNumber >= 3 && mapNumber <= 7) {
        if (mapState.isPicked && mapState.pickedBy !== undefined) {
          const teamTricode = this.data.teams[mapState.pickedBy]?.tricode || 'TEAM';
          
          // Set MAP DEF TEAM (team that picked gets to choose side, opponent defends)
          const defTeamIndex = mapState.pickedBy === 0 ? 1 : 0;
          const defTeamTricode = this.data.teams[defTeamIndex]?.tricode || 'TEAM';
          this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
          
          // Set MAP PICK TEAM
          this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
          
          // Set MAP PICK text (PICK or DECIDER for map 7)
          const pickText = mapNumber === 7 ? 'DECIDER' : 'PICK';
          this.riveService.setTextRun(`MAP ${mapNumber} PICK`, pickText);
        }
        
        // Set MAP TEXT (map name in ALL CAPS) for all maps that have a name
        if (sessionMap.name && sessionMap.name.trim() !== '') {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, sessionMap.name.toUpperCase());
        }
        
        // Handle past map scores
        if (mapState.isPastMap && mapState.mapScore) {
          this.riveService.setPastMapScore(mapNumber, mapState.mapScore, true);
        }
      }
    });
    
    // Update map states and ban texts with team data
    this.riveService.updateMapStates(mapStates, this.data.teams);
  }

  private isPastMap(sessionMap: SessionMap): boolean {
    // Check if this map has score data (indicating it's been played)
    // This would come from your data endpoint - adjust this logic based on your data structure
    return !!(sessionMap as any).score || !!(sessionMap as any).leftScore || !!(sessionMap as any).rightScore;
  }

  private getMapScore(sessionMap: SessionMap): { team1: number; team2: number } | null {
    // Extract score data from the session map
    // Adjust this based on your actual data structure
    const leftScore = (sessionMap as any).leftScore || (sessionMap as any).score?.left || 0;
    const rightScore = (sessionMap as any).rightScore || (sessionMap as any).score?.right || 0;
    
    if (leftScore !== undefined && rightScore !== undefined) {
      return { team1: leftScore, team2: rightScore };
    }
    
    return null;
  }
}

// Interface definitions (matching mapban-ui structure)
export interface ISessionData {
  sessionIdentifier: string;
  organizationName: string;
  teams: ISessionTeam[];
  format: "bo1" | "bo3" | "bo5" | undefined;
  availableMaps: SessionMap[];
  selectedMaps: SessionMap[];
  stage: Stage;
  actingTeamCode: string;
  actingTeam: 0 | 1;
}

export interface ISessionTeam {
  name: string;
  tricode: string;
  url: string;
}

export class SessionMap {
  name: string;
  bannedBy?: 0 | 1 = undefined; // 0 = left team, 1 = right team
  pickedBy?: 0 | 1 = undefined;
  sidePickedBy?: 0 | 1 = undefined;
  pickedAttack: boolean | undefined = undefined;

  constructor(name: string) {
    this.name = name;
  }
}

export type Stage = "ban" | "pick" | "side";
