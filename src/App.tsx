import { PipelineScreen } from './features/pipeline/PipelineScreen';
import { ServicesContext, type Services } from './services';

export function App({ services }: { services: Services }) {
  return (
    <ServicesContext.Provider value={services}>
      <PipelineScreen />
    </ServicesContext.Provider>
  );
}
