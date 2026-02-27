- Delta: Ex-employee reviews must be rejected; current sections focus on identity verification and client-plausibility but never forbid former employees even though the batch (65c00bb266e7c9aa6d0c9450) is rejected as “Reviews are not accepted from former employees.” Patch:
  ```
  + Reject any submission identified as coming from a former employee when policy disallows ex-staff reviews.
  ```