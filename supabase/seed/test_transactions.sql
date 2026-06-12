-- Seed: transações de teste para desenvolvimento
-- Substitua 'YOUR_TEST_USER_ID' pelo UUID do seu usuário de teste no Supabase Auth

DO $$
DECLARE
  v_user_id uuid;
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_month int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
BEGIN
  -- Tenta pegar o primeiro usuário da tabela users (usuário de dev)
  SELECT id INTO v_user_id FROM users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado. Crie um usuário primeiro via Auth.';
    RETURN;
  END IF;

  -- Limpa transações de teste existentes deste usuário no mês atual
  DELETE FROM transactions
  WHERE user_id = v_user_id
    AND origem IN ('csv', 'pdf', 'seed')
    AND data >= make_date(v_year, v_month, 1);

  -- Insere transações de teste
  INSERT INTO transactions (user_id, data, descricao_raw, categoria, subcategoria, valor, tipo, status_revisao, score_confianca, origem) VALUES
    (v_user_id, make_date(v_year, v_month, 1),  'Salário empresa',                  'Receita',      'Salário',         5500.00,  'credito', 'aprovado', 0.99, 'seed'),
    (v_user_id, make_date(v_year, v_month, 2),  'Aluguel apartamento',              'Moradia',      'Aluguel',        -1800.00, 'debito',  'aprovado', 0.97, 'seed'),
    (v_user_id, make_date(v_year, v_month, 3),  'Supermercado Pão de Açúcar',       'Alimentação',  'Supermercado',    -320.50,  'debito',  'aprovado', 0.95, 'seed'),
    (v_user_id, make_date(v_year, v_month, 5),  'Uber viagem trabalho',             'Transporte',   'Aplicativo',       -45.90,  'debito',  'aprovado', 0.93, 'seed'),
    (v_user_id, make_date(v_year, v_month, 7),  'Farmácia Droga Raia',              'Saúde',        'Farmácia',         -89.90,  'debito',  'revisar',  0.80, 'seed'),
    (v_user_id, make_date(v_year, v_month, 8),  'Netflix assinatura',               'Lazer',        'Streaming',        -55.90,  'debito',  'aprovado', 0.98, 'seed'),
    (v_user_id, make_date(v_year, v_month, 9),  'Restaurante Outback',              'Alimentação',  'Restaurante',     -142.00,  'debito',  'aprovado', 0.91, 'seed'),
    (v_user_id, make_date(v_year, v_month, 10), 'Conta de luz CEMIG',               'Moradia',      'Energia',         -180.00,  'debito',  'aprovado', 0.96, 'seed'),
    (v_user_id, make_date(v_year, v_month, 12), 'Posto Shell combustível',          'Transporte',   'Combustível',     -210.00,  'debito',  'aprovado', 0.94, 'seed'),
    (v_user_id, make_date(v_year, v_month, 14), 'Academia Smartfit mensalidade',    'Saúde',        'Academia',         -99.90,  'debito',  'aprovado', 0.97, 'seed');

  RAISE NOTICE 'Seed concluído: 10 transações inseridas para o usuário %', v_user_id;
END;
$$;
