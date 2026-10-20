import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppStateProvider } from "@/state/AppState";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/shell/AppShell";
import Home from "@/pages/Home";
import Discover from "@/pages/Discover";
import Upcoming from "@/pages/Upcoming";
import Speakers from "@/pages/Speakers";
import Companies from "@/pages/Companies";
import Events from "@/pages/Events";
import SpeakerProfile from "@/pages/SpeakerProfile";
import AppearanceDetail from "@/pages/AppearanceDetail";
import EventPage from "@/pages/EventPage";
import Topics from "@/pages/Topics";
import TopicPage from "@/pages/TopicPage";
import CompanyPage from "@/pages/CompanyPage";
import Library from "@/pages/Library";
import Notifications from "@/pages/Notifications";
import Subscription from "@/pages/Subscription";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import About from "@/pages/About";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import NotesArchive from "@/pages/NotesArchive";
import NoteIssue from "@/pages/NoteIssue";
import NotePreferences from "@/pages/NotePreferences";
import { ThemeProvider } from "@/components/theme";

export default function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/upcoming" element={<Upcoming />} />
              <Route path="/speakers" element={<Speakers />} />
              <Route path="/speakers/:slug" element={<SpeakerProfile />} />
              <Route path="/a/:slug" element={<AppearanceDetail />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:slug" element={<EventPage />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/topics/:slug" element={<TopicPage />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:slug" element={<CompanyPage />} />
              <Route path="/library" element={<Library />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/dashboard" element={<Profile />} />
              <Route path="/about" element={<About />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/stage-notes" element={<NotesArchive />} />
              <Route path="/stage-notes/preferences" element={<NotePreferences />} />
              <Route path="/stage-notes/:issueSlug" element={<NoteIssue />} />
              <Route path="/notes" element={<Navigate to="/stage-notes" replace />} />
              <Route path="/notes/preferences" element={<Navigate to="/stage-notes/preferences" replace />} />
              <Route path="/notes/:issueSlug" element={<Navigate to="/stage-notes" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppStateProvider>
    </ThemeProvider>
  );
}
