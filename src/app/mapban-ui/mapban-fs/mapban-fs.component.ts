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

  // Track if this is the first data load
  private isInitialLoad = true;
  private hasRealData = false; // Track if we've received actual data vs test data

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
          { name: "The Zoologists", tricode: "ZOO", teamUrl: "/assets/misc/icon.webp" },
          { name: "The Naturals", tricode: "INT", teamUrl: "/assets/misc/icon.webp" }
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
          { name: "The Zoologists", tricode: "ZOO", url: "/assets/misc/icon.webp" },
          { name: "The Naturals", tricode: "INT", url: "/assets/misc/icon.webp" }
        ],
        format: "bo3",
        availableMaps: [],
        selectedMaps: [
          // Actual chronological order: Icebox ban, Bind ban, Lotus pick, Haven pick, Corrode ban, Ascent ban, Sunset decider
          Object.assign(new SessionMap("Icebox"), { bannedBy: 0 }),    // BAN 1
          Object.assign(new SessionMap("Bind"), { bannedBy: 1 }),      // BAN 2
          Object.assign(new SessionMap("Lotus"), { pickedBy: 0 }),     // PICK 1
          Object.assign(new SessionMap("Haven"), { pickedBy: 1 }),     // PICK 2
          Object.assign(new SessionMap("Corrode"), { bannedBy: 0 }),   // BAN 3
          Object.assign(new SessionMap("Ascent"), { bannedBy: 1 }),    // BAN 4
          Object.assign(new SessionMap("Sunset"), {}) // DECIDER
        ],
        stage: "pick" as Stage,
        actingTeamCode: "ZOO",
        actingTeam: 0
      };
      console.log('⏳ Test data loaded - waiting for real data before starting animation');
    } else {
      // We have real data from input
      this.hasRealData = true;
      console.log('📡 Real data detected from input');
    }
    
    // Initialize Rive animation after view is ready
    this.initializeRiveAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && changes["data"].currentValue) {
      this.hasRealData = true; // Mark that we have real data from input
      console.log('📡 Real data received via input change');
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
      
      // Only prepare and start animation if we have real data
      if (this.hasRealData) {
        console.log('📊 Preparing animation with real data...');
        this.updateRiveAnimation();
      } else {
        console.log('⏳ Rive ready - waiting for real data before starting animation...');
        
        // Fallback: Start with test data after 5 seconds if no real data comes in
        // This is useful for development/testing when no socket data is available
        setTimeout(() => {
          if (!this.hasRealData && !this.riveService.isAnimationPlaying()) {
            console.log('⚠️ No real data received after 5 seconds, starting with test data for development');
            this.hasRealData = true; // Allow test data to be used
            this.updateRiveAnimation();
          }
        }, 5000);
      }
      
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
      '/assets/maps/wide/Pearl.webp',
      '/assets/maps/wide/Corrode.webp'
    ];

    // Add team logo URLs if available
    const teams = this.data?.teams || [];
    if (teams[0]?.url) {
      allAssetUrls.push(teams[0].url);
    }
    if (teams[1]?.url) {
      allAssetUrls.push(teams[1].url);
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
    const teams = this.data?.teams || [];
    const team1Url = teams[0]?.url || '/assets/misc/icon.webp';
    const team2Url = teams[1]?.url || '/assets/misc/logo.webp'; // Default to a different logo for debugging
    
    const assets: MapbanFsAssets = {
      team1Logo: team1Url,
      team2Logo: team2Url,
    };

    console.log('🏗️ Building mapban-fs assets with team logos:', {
      team1Logo: team1Url,
      team2Logo: team2Url,
      team1Name: teams[0]?.name,
      team2Name: teams[1]?.name,
    });

    // Determine series format based on bans
    const totalBans = this.data?.selectedMaps?.filter(map => map.bannedBy !== undefined).length || 0;
    const isBO3 = totalBans === 4;
    const isBO5 = totalBans === 2;

    // Separate maps by type from chronological order
    const bannedMaps = this.data?.selectedMaps?.filter(map => map.bannedBy !== undefined) || [];
    const pickedMaps = this.data?.selectedMaps?.filter(map => map.pickedBy !== undefined) || [];
    const deciderMaps = this.data?.selectedMaps?.filter(map => map.bannedBy === undefined && map.pickedBy === undefined) || [];

    console.log('📊 Map distribution:', {
      banned: bannedMaps.map(m => m.name),
      picked: pickedMaps.map(m => m.name),
      decider: deciderMaps.map(m => m.name),
      isBO3,
      isBO5
    });

    // Assign map images based on animation layout structure
    if (isBO3) {
      // BO3: Maps 1-4 are bans, Maps 5-7 are picks/decider
      
      // Assign banned maps to positions 1-4
      for (let i = 0; i < 4 && i < bannedMaps.length; i++) {
        const mapKey = `map_${i + 1}` as keyof MapbanFsAssets;
        const mapName = bannedMaps[i]?.name;
        assets[mapKey] = mapName ? `/assets/maps/wide/${mapName}.webp` : '/assets/maps/wide/Ascent.webp';
      }
      
      // Assign picked maps to positions 5-6
      for (let i = 0; i < 2 && i < pickedMaps.length; i++) {
        const mapKey = `map_${i + 5}` as keyof MapbanFsAssets;
        const mapName = pickedMaps[i]?.name;
        assets[mapKey] = mapName ? `/assets/maps/wide/${mapName}.webp` : '/assets/maps/wide/Ascent.webp';
      }
      
      // Assign decider to position 7
      if (deciderMaps.length > 0) {
        assets.map_7 = `/assets/maps/wide/${deciderMaps[0].name}.webp`;
      }
    } else if (isBO5) {
      // BO5: Maps 1-2 are bans, Maps 3-7 are picks/decider
      
      // Assign banned maps to positions 1-2
      for (let i = 0; i < 2 && i < bannedMaps.length; i++) {
        const mapKey = `map_${i + 1}` as keyof MapbanFsAssets;
        const mapName = bannedMaps[i]?.name;
        assets[mapKey] = mapName ? `/assets/maps/wide/${mapName}.webp` : '/assets/maps/wide/Ascent.webp';
      }
      
      // Assign picked maps to positions 3-6
      for (let i = 0; i < 4 && i < pickedMaps.length; i++) {
        const mapKey = `map_${i + 3}` as keyof MapbanFsAssets;
        const mapName = pickedMaps[i]?.name;
        assets[mapKey] = mapName ? `/assets/maps/wide/${mapName}.webp` : '/assets/maps/wide/Ascent.webp';
      }
      
      // Assign decider to position 7
      if (deciderMaps.length > 0) {
        assets.map_7 = `/assets/maps/wide/${deciderMaps[0].name}.webp`;
      }
    } else {
      // Fallback: Use sequential order if format is unclear
      for (let i = 1; i <= 7; i++) {
        const mapKey = `map_${i}` as keyof MapbanFsAssets;
        const mapIndex = i - 1;
        const sessionMap = this.data?.selectedMaps?.[mapIndex];
        const mapName = sessionMap?.name;
        assets[mapKey] = mapName ? `/assets/maps/wide/${mapName}.webp` : '/assets/maps/wide/Ascent.webp';
      }
    }

    console.log('🏗️ Built mapban-fs assets:', assets);
    return assets;
  }

  private updateMapbanData(socketData: any): void {
    let dataUpdated = false;
    
    if (socketData.data) {
      this.data = socketData.data;
      this.hasRealData = true; // Mark that we have real data
      dataUpdated = true;
      console.log('📡 Real session data received via socket');
    }
    if (socketData.match) {
      this.match = socketData.match;
      console.log('📡 Real match data received via socket');
    }
    
    // Only update animation if we have real data
    if (dataUpdated && this.hasRealData) {
      console.log('🔄 Updating animation with real data');
      this.updateRiveAnimation();
    } else if (!this.hasRealData) {
      console.log('⏳ Ignoring update - still waiting for real session data');
    }
  }

  private updateRiveAnimation(): void {
    if (!this.data || !this.riveService.getRive()) {
      console.log('⏸️ Skipping Rive update - missing data or Rive not initialized');
      return;
    }
    
    // Don't start animation with test data - wait for real data
    if (!this.hasRealData) {
      console.log('⏳ Skipping animation start - waiting for real data (currently using test data)');
      return;
    }
    
    console.log('🔄 Updating Rive animation with real data:', this.data);
    
    // Handle differently for initial load vs subsequent updates
    const shouldPauseForUpdate = !this.isInitialLoad && this.riveService.isAnimationPlaying();
    
    if (shouldPauseForUpdate) {
      console.log('⏸️ Pausing animation for data update...');
      this.riveService.pauseAnimation();
    }
    
    try {
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
      
      console.log('✅ All real data updated');
      
      // Start animation for initial load, or resume for subsequent updates
      setTimeout(() => {
        if (this.isInitialLoad) {
          this.riveService.startAnimationWithData();
          console.log('🎬 Animation started with complete real data');
          this.isInitialLoad = false;
        } else if (shouldPauseForUpdate) {
          this.riveService.playAnimation();
          console.log('▶️ Animation resumed after real data update');
        }
      }, this.isInitialLoad ? 100 : 50); // Longer delay for initial load
      
    } catch (error) {
      console.error('❌ Error during animation update:', error);
      // Still start/resume animation even if there was an error
      setTimeout(() => {
        if (this.isInitialLoad) {
          this.riveService.startAnimationWithData();
          this.isInitialLoad = false;
        } else if (shouldPauseForUpdate) {
          this.riveService.playAnimation();
        }
      }, this.isInitialLoad ? 100 : 50);
    }
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
    
    // Determine series format
    const totalBans = this.data.selectedMaps.filter(map => map.bannedBy !== undefined).length;
    const isBO3 = totalBans === 4;
    const isBO5 = totalBans === 2;

    // Separate maps by type from chronological order
    const bannedMaps = this.data.selectedMaps.filter(map => map.bannedBy !== undefined);
    const pickedMaps = this.data.selectedMaps.filter(map => map.pickedBy !== undefined);
    const deciderMaps = this.data.selectedMaps.filter(map => map.bannedBy === undefined && map.pickedBy === undefined);

    // Set text runs based on animation layout structure
    if (isBO3) {
      // BO3: Maps 1-4 are bans, Maps 5-7 are picks/decider
      
      // Set ban text runs for positions 1-4
      for (let i = 0; i < 4; i++) {
        const mapNumber = i + 1;
        const bannedMap = bannedMaps[i];
        
        if (bannedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, bannedMap.name.toUpperCase());
          
          const mapState: MapState = {
            mapNumber,
            mapName: bannedMap.name,
            isBanned: true,
            isPicked: false,
            bannedBy: bannedMap.bannedBy,
            pickedBy: undefined,
            isPastMap: this.isPastMap(bannedMap),
            mapScore: this.getMapScore(bannedMap)
          };
          mapStates.push(mapState);
        }
      }
      
      // Set pick text runs for positions 5-6
      for (let i = 0; i < 2; i++) {
        const mapNumber = i + 5;
        const pickedMap = pickedMaps[i];
        
        if (pickedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, pickedMap.name.toUpperCase());
          
          // Set pick team information
          const teamTricode = this.data.teams[pickedMap.pickedBy!]?.tricode || 'TEAM';
          const defTeamIndex = pickedMap.pickedBy === 0 ? 1 : 0;
          const defTeamTricode = this.data.teams[defTeamIndex]?.tricode || 'TEAM';
          
          this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK`, 'PICK');
          
          // Handle pastMap and score display
          const isPastMap = this.isPastMap(pickedMap);
          const mapScore = this.getMapScore(pickedMap);
          
          console.log(`🔍 BO3 Map ${mapNumber} (${pickedMap.name}) debug:`, {
            score: pickedMap.score,
            isPastMap,
            mapScore
          });
          
          if (isPastMap && mapScore) {
            // Only call setPastMapScore if there's actual score data
            this.riveService.setPastMapScore(mapNumber, mapScore, true);
            console.log(`📊 Map ${mapNumber} (${pickedMap.name}) marked as past map with score: ${mapScore}`);
          } else {
            // Explicitly reset pastMap to false for maps without score data
            this.riveService.setPastMapScore(mapNumber, null, false);
            console.log(`⏭️ Map ${mapNumber} (${pickedMap.name}) explicitly reset pastMap to false`);
          }
          
          const mapState: MapState = {
            mapNumber,
            mapName: pickedMap.name,
            isBanned: false,
            isPicked: true,
            bannedBy: undefined,
            pickedBy: pickedMap.pickedBy,
            isPastMap,
            mapScore
          };
          mapStates.push(mapState);
        }
      }
      
      // Set decider text run for position 7
      if (deciderMaps.length > 0) {
        const deciderMap = deciderMaps[0];
        this.riveService.setTextRun('MAP 7 TEXT', deciderMap.name.toUpperCase());
        this.riveService.setTextRun('MAP 7 PICK', 'DECIDER');
        
        // Handle pastMap and score display for decider
        const isPastMap = this.isPastMap(deciderMap);
        const mapScore = this.getMapScore(deciderMap);
        
        console.log(`🔍 BO3 Decider Map 7 (${deciderMap.name}) debug:`, {
          score: deciderMap.score,
          isPastMap,
          mapScore
        });
        
        if (isPastMap && mapScore) {
          // Only call setPastMapScore if there's actual score data
          this.riveService.setPastMapScore(7, mapScore, true);
          console.log(`📊 Map 7 (${deciderMap.name}) marked as past map with score: ${mapScore}`);
        } else {
          // Explicitly reset pastMap to false for maps without score data
          this.riveService.setPastMapScore(7, null, false);
          console.log(`⏭️ Map 7 (${deciderMap.name}) explicitly reset pastMap to false`);
        }
        
        const mapState: MapState = {
          mapNumber: 7,
          mapName: deciderMap.name,
          isBanned: false,
          isPicked: false,
          bannedBy: undefined,
          pickedBy: undefined,
          isPastMap,
          mapScore
        };
        mapStates.push(mapState);
      }
    } else if (isBO5) {
      // BO5: Maps 1-2 are bans, Maps 3-7 are picks/decider
      
      // Set ban text runs for positions 1-2
      for (let i = 0; i < 2; i++) {
        const mapNumber = i + 1;
        const bannedMap = bannedMaps[i];
        
        if (bannedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, bannedMap.name.toUpperCase());
          
          const mapState: MapState = {
            mapNumber,
            mapName: bannedMap.name,
            isBanned: true,
            isPicked: false,
            bannedBy: bannedMap.bannedBy,
            pickedBy: undefined,
            isPastMap: this.isPastMap(bannedMap),
            mapScore: this.getMapScore(bannedMap)
          };
          mapStates.push(mapState);
        }
      }
      
      // Set pick text runs for positions 3-6
      for (let i = 0; i < 4; i++) {
        const mapNumber = i + 3;
        const pickedMap = pickedMaps[i];
        
        if (pickedMap) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, pickedMap.name.toUpperCase());
          
          // Set pick team information
          const teamTricode = this.data.teams[pickedMap.pickedBy!]?.tricode || 'TEAM';
          const defTeamIndex = pickedMap.pickedBy === 0 ? 1 : 0;
          const defTeamTricode = this.data.teams[defTeamIndex]?.tricode || 'TEAM';
          
          this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
          this.riveService.setTextRun(`MAP ${mapNumber} PICK`, 'PICK');
          
          // Handle pastMap and score display
          const isPastMap = this.isPastMap(pickedMap);
          const mapScore = this.getMapScore(pickedMap);
          
          console.log(`🔍 BO5 Map ${mapNumber} (${pickedMap.name}) debug:`, {
            score: pickedMap.score,
            isPastMap,
            mapScore
          });
          
          if (isPastMap && mapScore) {
            // Only call setPastMapScore if there's actual score data
            this.riveService.setPastMapScore(mapNumber, mapScore, true);
            console.log(`📊 Map ${mapNumber} (${pickedMap.name}) marked as past map with score: ${mapScore}`);
          } else {
            // Explicitly reset pastMap to false for maps without score data
            this.riveService.setPastMapScore(mapNumber, null, false);
            console.log(`⏭️ Map ${mapNumber} (${pickedMap.name}) explicitly reset pastMap to false`);
          }
          
          const mapState: MapState = {
            mapNumber,
            mapName: pickedMap.name,
            isBanned: false,
            isPicked: true,
            bannedBy: undefined,
            pickedBy: pickedMap.pickedBy,
            isPastMap,
            mapScore
          };
          mapStates.push(mapState);
        }
      }
      
      // Set decider text run for position 7
      if (deciderMaps.length > 0) {
        const deciderMap = deciderMaps[0];
        this.riveService.setTextRun('MAP 7 TEXT', deciderMap.name.toUpperCase());
        this.riveService.setTextRun('MAP 7 PICK', 'DECIDER');
        
        const mapState: MapState = {
          mapNumber: 7,
          mapName: deciderMap.name,
          isBanned: false,
          isPicked: false,
          bannedBy: undefined,
          pickedBy: undefined,
          isPastMap: this.isPastMap(deciderMap),
          mapScore: this.getMapScore(deciderMap)
        };
        mapStates.push(mapState);
      }
    } else {
      // Fallback: Use chronological order if format is unclear
      this.data.selectedMaps.forEach((sessionMap, index) => {
        const mapNumber = index + 1;
        const mapState: MapState = {
          mapNumber,
          mapName: sessionMap.name,
          isBanned: sessionMap.bannedBy !== undefined,
          isPicked: sessionMap.pickedBy !== undefined,
          bannedBy: sessionMap.bannedBy,
          pickedBy: sessionMap.pickedBy,
          isPastMap: this.isPastMap(sessionMap),
          mapScore: this.getMapScore(sessionMap)
        };
        mapStates.push(mapState);
        
        // Set text runs
        if (mapState.isBanned) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, sessionMap.name.toUpperCase());
        } else if (mapNumber >= 3 && mapNumber <= 7) {
          this.riveService.setTextRun(`MAP ${mapNumber} TEXT`, sessionMap.name.toUpperCase());
          
          if (mapState.isPicked && mapState.pickedBy !== undefined) {
            const teamTricode = this.data.teams[mapState.pickedBy]?.tricode || 'TEAM';
            const defTeamIndex = mapState.pickedBy === 0 ? 1 : 0;
            const defTeamTricode = this.data.teams[defTeamIndex]?.tricode || 'TEAM';
            
            this.riveService.setTextRun(`MAP ${mapNumber} DEF TEAM`, defTeamTricode);
            this.riveService.setTextRun(`MAP ${mapNumber} PICK TEAM`, teamTricode);
            this.riveService.setTextRun(`MAP ${mapNumber} PICK`, mapNumber === 7 ? 'DECIDER' : 'PICK');
          }
        }
      });
    }
    
    // Update map states and ban texts with team data
    this.riveService.updateMapStates(mapStates, this.data.teams);
  }

  private isPastMap(sessionMap: SessionMap): boolean {
    // Check if this map has valid score data (indicating it's been played)
    return sessionMap.score && 
           sessionMap.score[0] !== undefined && 
           sessionMap.score[1] !== undefined &&
           typeof sessionMap.score[0] === 'number' &&
           typeof sessionMap.score[1] === 'number';
  }

  private getMapScore(sessionMap: SessionMap): { team1: number; team2: number } | string | null {
    // Extract score data from the session map
    if (!sessionMap.score || 
        sessionMap.score[0] === undefined || 
        sessionMap.score[1] === undefined) {
      return null;
    }
    
    const score1 = sessionMap.score[0];
    const score2 = sessionMap.score[1];
    
    // Return formatted score string with higher score first
    if (score1 > score2) {
      return `${score1} - ${score2}`;
    } else {
      return `${score2} - ${score1}`;
    }
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
  score: (number | undefined)[] = [undefined, undefined];

  constructor(name: string) {
    this.name = name;
  }
}

export type Stage = "ban" | "pick" | "side";
