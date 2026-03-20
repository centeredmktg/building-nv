-- CreateIndex
CREATE UNIQUE INDEX "QuoteContact_quoteId_contactId_key" ON "QuoteContact"("quoteId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteCompany_quoteId_companyId_key" ON "QuoteCompany"("quoteId", "companyId");
