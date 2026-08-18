import CategorySelect from "../../components/CategorySelect";

export default function TodoCategorySelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <CategorySelect
      value={value}
      onChange={onChange}
      endpoint="/todo-categories"
      queryKey="todo-categories"
      invalidateKey="todos"
      deleteMessage="Tasks in this category keep their details, but lose the category label."
    />
  );
}
