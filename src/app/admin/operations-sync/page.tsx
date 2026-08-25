import { getOperationsRequests } from "@/app/actions/operations-sync";
import OperationsSyncClient from "./OperationsSyncClient";

export const dynamic = "force-dynamic";

export default async function OperationsSyncPage() {
  const requests = await getOperationsRequests();
  return <OperationsSyncClient initialRequests={requests} />;
}
