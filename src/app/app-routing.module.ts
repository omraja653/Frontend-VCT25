import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { TestingComponent } from "./testing/testing.component";
import { OverlayComponent } from "./overlay/overlay.component";
import { AgentSelectRouterComponent } from "./agent-select/agent-select-router.component";
import { AutoswitchComponent } from "./autoswitch/autoswitch.component";
import { RedirectComponent } from "./redirect/redirect.component";
import { TimeoutComponent } from "./timeout/timeout.component";
import { AgentSelectTestingRouterComponent } from "./testing/agent-select/agent-select-testing-router.component";
import { MapbanUiComponent } from "./mapban-ui/mapban-ui.component";
import { MapbanFsComponent } from "./mapban-ui/mapban-fs/mapban-fs.component";

export const routes: Routes = [
  {
    path: "",
    component: RedirectComponent,
  },
  {
    path: "overlay",
    children: [
      {
        path: "",
        component: OverlayComponent,
      },
      {
        path: "minimal",
        component: OverlayComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "testing",
    children: [
      {
        path: "",
        component: TestingComponent,
      },
      {
        path: "minimal",
        component: TestingComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "agent-select",
    component: AgentSelectRouterComponent,
  },
  {
    path: "autoswitch",
    children: [
      {
        path: "",
        component: AutoswitchComponent,
      },
      {
        path: "minimal",
        component: AutoswitchComponent,
        data: {
          minimal: true,
        },
      },
    ],
  },
  {
    path: "timeout",
    component: TimeoutComponent,
  },
  {
    path: "testing/agent-select",
    component: AgentSelectTestingRouterComponent,
  },
  {
    path: "mapban",
    component: MapbanUiComponent,
  },
  {
    path: "mapban-fs",
    component: MapbanFsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
