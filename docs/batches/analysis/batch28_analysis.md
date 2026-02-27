Delta: need rule for blank submissions because doc assumes upstream completeness and no existing rule covers zero-text reviews; evidence record 66a8bffbcabb9e7aec084b09 (TestInvite) has title/summary/strength/weakness/ratings all empty.  
Patch:  
+ Reject reviews lacking any narrative/rating content before verification so blanks never reach this policy.