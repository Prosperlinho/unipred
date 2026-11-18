-- UniPred 0020: open UniPred at every university again (undoes the AE-FUNAI-only setting from 0012).
update public.schools set active = true;
