import { partsOf } from '../../utils/cargo';
import styles from './CanvasControls.module.css';

export default function ObjectProperties({ object, disabled, onSave }) {
    const noTopLoad = partsOf(object).some(part => part.kind && part.kind !== 'box');
    const plainBox = !object.parts?.length && (!object.shape || object.shape === 'box');

    function submit(event) {
        event.preventDefault();
        const { weight, capacity, delivery } = event.currentTarget.elements;
        if (weight.valueAsNumber <= 0) {
            weight.setCustomValidity('Informe um peso maior que zero.');
            weight.reportValidity();
            return;
        }
        onSave({
            weight: weight.valueAsNumber,
            max_load: noTopLoad ? 0 : capacity.value === '' ? null : capacity.valueAsNumber,
            delivery_order: delivery.valueAsNumber,
        });
    }

    return <form className={styles.inputRow} onSubmit={submit}>
        <label className={styles.inputLabel}>Peso do objeto (kg)
            <input className={styles.numberInput} name="weight" type="number" min="0" step="any"
                required disabled={disabled} defaultValue={object.weight ?? 10}
                onInput={event => event.currentTarget.setCustomValidity('')} />
        </label>
        <label className={styles.inputLabel}>Carga máxima sobre o objeto (kg)
            <input className={styles.numberInput} name="capacity" type="number" min="0" step="any"
                disabled={disabled || noTopLoad} required={!plainBox}
                placeholder="Sem limite informado"
                defaultValue={noTopLoad ? 0 : object.max_load ?? (plainBox ? '' : 0)} />
        </label>
        {noTopLoad && <small className={styles.stats}>O modelo não permite apoiar carga sobre esta forma.</small>}
        <label className={styles.inputLabel}>Ordem de entrega
            <input className={styles.numberInput} name="delivery" type="number" min="1" step="1"
                required disabled={disabled} defaultValue={object.delivery_order ?? 1} />
        </label>
        <button type="submit" className={styles.addButton} disabled={disabled}>Aplicar alterações</button>
    </form>;
}
