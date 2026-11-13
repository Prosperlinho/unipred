-- OPTIONAL: open six starter markets so the feed isn't empty on day one.
-- Change v_school to the university you're launching at, then run in the SQL Editor.
-- Each market is opened with ₦20,000 of house liquidity at the given starting odds.
do $$
declare
  v_school text := 'unilag';
  r record;
  v_l numeric := 2000000::numeric / 10000;  -- ₦20,000 (2,000,000 kobo) = 200 shares of ₦100
begin
  for r in select * from (values
    ('Will the SUG presidential election go into a rerun?', 'Campus Politics',
     'Resolves YES if the Students'' Union Electoral Committee officially announces a rerun or runoff between presidential candidates before the closing time. Resolves NO if a winner is declared outright.',
     'SUG Electoral Committee official notice', 0.38, interval '5 days'),
    ('Will GST 101 results be released on the portal before Friday?', 'Academics',
     'Resolves YES if GST 101 results are visible on the official student result portal for at least one faculty before Friday 11:59 PM. Screenshots in group chats do not count.',
     'Official student result portal', 0.27, interval '2 days'),
    ('Will Engineering beat Social Sciences in the VC Cup semi-final?', 'Sports',
     'Resolves YES if the Faculty of Engineering wins the VC Cup semi-final against Social Sciences, including extra time or penalties. A walkover or postponement past the closing time resolves NO.',
     'Sports Council official result sheet', 0.62, interval '1 day 3 hours'),
    ('Will the hostels get 12+ straight hours of power supply this weekend?', 'Events & Lifestyle',
     'Resolves YES if any main undergraduate hostel records an uninterrupted 12-hour power supply between Saturday 00:00 and Sunday 23:59, as confirmed by the Works Department.',
     'Works & Services Department announcement', 0.19, interval '3 days'),
    ('Will ASUU declare a strike before the end of this semester?', 'Campus Politics',
     'Resolves YES if ASUU''s National Executive Council officially declares a warning or indefinite strike before the closing time. Threats, ultimatums or branch-level actions do not count.',
     'Official ASUU NEC communiqué reported by two national newspapers', 0.44, interval '21 days'),
    ('Will the Final Year Dinner sell out all tickets before Saturday?', 'Events & Lifestyle',
     'Resolves YES if the organising committee announces that all regular and VIP tickets are sold out before Saturday 12:00 PM.',
     'Organising committee''s official Instagram', 0.71, interval '4 days')
  ) as t(question, category, criteria, source, prob, closes_in)
  loop
    insert into public.markets
      (school_id, question, category, criteria, source, closes_at, status, initial_prob,
       pool_yes, pool_no, liquidity_kobo, approved_at)
    values
      (v_school, r.question, r.category, r.criteria, r.source, now() + r.closes_in, 'open', r.prob,
       2 * v_l * (1 - r.prob), 2 * v_l * r.prob, 2000000, now());
  end loop;
end $$;
