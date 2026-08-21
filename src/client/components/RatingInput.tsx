export function RatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="rating-input">
      <legend>Calificación</legend>
      <div role="radiogroup" aria-label="Calificación del viaje">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" role="radio" aria-checked={value === rating} onClick={() => onChange(rating)}>
            <span aria-hidden="true">{rating <= value ? '★' : '☆'}</span><span className="sr-only">{rating} de 5</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
