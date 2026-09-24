import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';

import { AdminSectionNav } from '../components/admin-section-nav';
import { CatalogImportReviewPanel } from '../components/catalog-review-panel';

export function CatalogCurationPage() {
  return (
    <PageContainer>
      <PageTitle
        description="Review staged source imports before they are published into the make, model and variant catalog."
        title="Catalog curation"
      />
      <AdminSectionNav />
      <CatalogImportReviewPanel />
    </PageContainer>
  );
}
