import { Redirect } from "expo-router";
import { useSession } from "../hooks/useSession";
import { Loading, Screen } from "../components/ui";

export default function Index() {
  const { ready, token } = useSession();
  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Redirect href={token ? "/(tabs)" : "/sign-in"} />;
}
