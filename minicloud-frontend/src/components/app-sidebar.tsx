import * as React from "react"
import {
  Upload,
  Database,
  Search,
  Activity,
  Cloud,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// Mini Data Cloud navigation data
const data = {
  user: {
    name: "Data Analyst",
    email: "analyst@minicloud.com",
    avatar: "/avatars/user.jpg",
  },
  teams: [
    {
      name: "Mini Data Cloud",
      logo: Cloud,
      plan: "Development",
    },
  ],
  navMain: [
    {
      title: "Upload",
      url: "/upload",
      icon: Upload,
    },
    {
      title: "Tables",
      url: "/tables",
      icon: Database,
    },
    {
      title: "Query",
      url: "/query",
      icon: Search,
    },
    {
      title: "Monitoring",
      url: "/monitoring",
      icon: Activity,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
