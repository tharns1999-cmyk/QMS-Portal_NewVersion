# Periodic Review UAT Execution Checklist

## 1. Before UAT
- [ ] Git commit and Git tag are documented and deployed to the UAT environment.
- [ ] Application version is visible on the login screen or dashboard.
- [ ] UAT environment is accessible to all designated testers.
- [ ] UAT Personas (P-001 to P-011) are available and credentials distributed.
- [ ] Deterministic Test Data is pre-loaded or available via localStorage fixture.
- [ ] Browser cache clearing procedures have been communicated to testers.
- [ ] All automated tests (unit, e2e, lint, build) have passed on this specific Git commit.
- [ ] Production databases are NOT connected to this UAT instance.

## 2. During UAT
- [ ] Tester MUST use only their assigned UAT Persona for specific test cases.
- [ ] Tester MUST record the "Actual Result" in the Test Cases document or CSV.
- [ ] Tester MUST take screenshots for every "Fail" result.
- [ ] Tester MUST log a Defect in the Defect Log for every "Fail" result.
- [ ] Tester MUST NOT manually alter the state (e.g. modify localStorage directly) unless explicitly instructed in the test case preconditions.
- [ ] If a test requires resetting state, use the approved reset procedure between test cycles.

## 3. After UAT
- [ ] Collect all Test Case CSVs from testers.
- [ ] Review all failed cases and associated Defect Logs.
- [ ] Assign Priority/Severity to defects with the Business Owner.
- [ ] Verify 100% of Critical and Access Control cases have passed.
- [ ] Confirm no unrelated department data was exposed.
- [ ] Confirm +1 year Revision and no-cycle Obsolete behaviors were validated.
- [ ] Sign off on the UAT Summary if Acceptance Criteria are met.
